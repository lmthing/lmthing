# CSS Modules

Scoped CSS by generating unique class names.

**Usage:**
```tsx
import styles from './Component.module.css'

<div className={styles.container} />
```

**Benefits:**
- No global namespace pollution
- Dead code elimination
- Composable styles
- Type-safe with CSS modules typedef