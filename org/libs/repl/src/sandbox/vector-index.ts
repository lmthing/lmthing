/**
 * VectorIndex — in-memory TF-IDF semantic search on past reasoning.
 *
 * No external dependencies. Uses TF-IDF (term frequency–inverse document frequency)
 * with cosine similarity to find semantically similar comment blocks and code.
 *
 * Usage:
 *   const index = new VectorIndex();
 *   index.index("// Calculate sum of array", const sum = arr.reduce(...), turn);
 *   const results = index.search("array summation");
 */

export interface VectorMatch {
  turn: number;
  score: number;
  text: string;
  code: string;
}

export interface VectorIndexOptions {
  maxDocuments?: number;
  minTermLength?: number;
  stopWords?: Set<string>;
}

const DEFAULT_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by',
  'for', 'if', 'in', 'into', 'is', 'it', 'no', 'not',
  'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then',
  'there', 'these', 'they', 'this', 'to', 'was', 'will', 'with',
  'const', 'let', 'var', 'function', 'return', 'await', 'async',
  'import', 'export', 'from', 'class', 'interface', 'type',
]);

/**
 * TF-IDF vector index for semantic search on code + comments.
 */
export class VectorIndex {
  private documents: Array<{ turn: number; text: string; code: string; terms: string[] }> = [];
  private idf: Map<string, number> = new Map();
  private options: Required<VectorIndexOptions>;

  constructor(options: VectorIndexOptions = {}) {
    this.options = {
      maxDocuments: options.maxDocuments ?? 1000,
      minTermLength: options.minTermLength ?? 2,
      stopWords: options.stopWords ?? DEFAULT_STOP_WORDS,
    };
  }

  /**
   * Tokenize text into terms, filtering stop words and short terms.
   */
  private tokenize(text: string): string[] {
    // Convert to lowercase and split on non-alphanumeric
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(t => t.length >= this.options.minTermLength)
      .filter(t => !this.options.stopWords.has(t));

    return [...new Set(tokens)]; // unique terms per document
  }

  /**
   * Compute TF-IDF score for a term in a document.
   */
  private tfIdf(term: string, docTerms: string[]): number {
    // Term frequency in document
    const tf = docTerms.filter(t => t === term).length;
    // Inverse document frequency (with smoothing)
    const df = this.documents.filter(d => d.terms.includes(term)).length + 1;
    const idf = Math.log((this.documents.length + 1) / df);
    return tf * idf;
  }

  /**
   * Compute cosine similarity between two term vectors.
   */
  private cosineSimilarity(termsA: string[], termsB: string[]): number {
    const uniqueTerms = new Set([...termsA, ...termsB]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of uniqueTerms) {
      const tfA = termsA.filter(t => t === term).length;
      const tfB = termsB.filter(t => t === term).length;
      dotProduct += tfA * tfB;
      normA += tfA * tfA;
      normB += tfB * tfB;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;
    return dotProduct / denominator;
  }

  /**
   * Index a document (text + code) for a given turn.
   * Extracts comments from code for semantic indexing.
   */
  index(text: string, code: string, turn: number): void {
    // Combine text and code comments for indexing
    const combined = `${text} ${this.extractComments(code)}`;
    const terms = this.tokenize(combined);

    this.documents.push({ turn, text, code, terms });

    // Limit document count
    if (this.documents.length > this.options.maxDocuments) {
      this.documents.shift();
    }

    // Recompute IDF when new document added
    this.recomputeIdf();
  }

  /**
   * Extract comments from code (single-line and multi-line).
   */
  private extractComments(code: string): string {
    const comments: string[] = [];

    // Single-line comments
    for (const line of code.split('\n')) {
      const singleMatch = line.match(/\/\/(.*)$/);
      if (singleMatch) {
        comments.push(singleMatch[1].trim());
      }
    }

    // Multi-line comments
    const multiMatch = code.match(/\/\*([\s\S]*?)\*\//g);
    if (multiMatch) {
      for (const match of multiMatch) {
        const content = match.slice(2, -2).trim();
        comments.push(content);
      }
    }

    return comments.join(' ');
  }

  /**
   * Recompute IDF scores for all terms.
   */
  private recomputeIdf(): void {
    this.idf.clear();
    const totalDocs = this.documents.length;

    // Collect all unique terms
    const allTerms = new Set<string>();
    for (const doc of this.documents) {
      for (const term of doc.terms) {
        allTerms.add(term);
      }
    }

    // Compute IDF for each term
    for (const term of allTerms) {
      const df = this.documents.filter(d => d.terms.includes(term)).length;
      this.idf.set(term, Math.log(totalDocs / df));
    }
  }

  /**
   * Search for similar documents using TF-IDF cosine similarity.
   */
  search(query: string, topK: number = 5): VectorMatch[] {
    const queryTerms = this.tokenize(query);
    const results: VectorMatch[] = [];

    for (const doc of this.documents) {
      // Compute cosine similarity between query and document
      const score = this.cosineSimilarity(queryTerms, doc.terms);
      if (score > 0) {
        results.push({
          turn: doc.turn,
          score,
          text: doc.text,
          code: doc.code,
        });
      }
    }

    // Sort by score descending and return top K
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Get number of indexed documents.
   */
  get size(): number {
    return this.documents.length;
  }

  /**
   * Clear all indexed documents.
   */
  clear(): void {
    this.documents = [];
    this.idf.clear();
  }
}
