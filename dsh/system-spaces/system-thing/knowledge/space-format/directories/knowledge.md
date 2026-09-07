`knowledge/<domain>/index.md` is a domain's overview; `knowledge/<domain>/<field>/` can further
split it into named options, each its own markdown file, so an agent loads only the slice a
question actually needs instead of every fact it might ever cite.

`write_knowledge` writes the simplest useful shape: one domain, one `index.md`, no sub-fields —
and registers the domain in the target agent's `instruct.md` `knowledge: [...]` list so it is
actually reachable. An agent that never loads its knowledge and answers from general training data
instead is doing it wrong — ground answers in what the domain says, and say plainly when it
doesn't cover something.
