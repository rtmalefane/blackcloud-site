// app/components/GalaxyBackground.tsx
type Props = {
  overlayClassName?: string;
};

export default function GalaxyBackground({ overlayClassName = "" }: Props) {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="galaxy-bg" />
      <div className="galaxy-stars" />
      <div className="galaxy-vignette" />
      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}
    </div>
  );
}