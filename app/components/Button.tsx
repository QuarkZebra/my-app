type ButtonProps = {
  label: string
  href: string
}

export default function Button({ label, href }: ButtonProps) {
  return (
    <a
      href={href}
      className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
    >
      {label}
    </a>
  )
}