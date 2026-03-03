# L-systems
L-systems rendering app


## Multi-character symbols (edge rewriting)
You can now use multi-character rule keys such as `Fl` and `Fr` for edge rewriting.

Example:

```
Axiom: Fl
Fl=Fl+Fr+
Fr=-Fl-Fr
```

Tokens that start with `F` draw a segment, and tokens that start with `f` move without drawing.
