type Props = {
  size?: number
}

// Renders Farmxie's actual logo file.
// The image must live at /public/logo.png in the repo root
// (Vite copies everything in /public to the site root at build time).
// The ?v= suffix makes browsers fetch the file again after the logo is replaced.
export default function FarmLiteLogo({ size = 72 }: Props) {
  return (
    <img
      src="/logo.png?v=2"
      alt="Farmxie"
      width={size}
      height={size}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  )
}
