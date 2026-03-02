# Styled Components

CSS-in-JS library with styled components and theme support.

**Usage:**
```tsx
const Button = styled.button<ButtonProps>`
  background: ${props => props.primary ? 'blue' : 'gray'};
  padding: 12px 24px;
`
```

**Features:**
- Dynamic styling via props
- Theme provider
- Automatic vendor prefixing
- No class name conflicts