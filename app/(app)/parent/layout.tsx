/**
 * Parent layout — sets data-view so globals.css applies 18px base.
 * The attribute is on <html>, so we use a Script-less workaround:
 * set it via a root className handled in the inline script below.
 *
 * Actually, Next 14 doesn't support modifying <html> attributes from
 * nested layouts without a Client Component. Simplest approach:
 * add a root wrapper with the larger base font and let descendant
 * styles inherit.
 */
export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="text-[18px] leading-relaxed">{children}</div>;
}
