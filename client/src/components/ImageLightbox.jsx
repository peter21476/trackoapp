export default function ImageLightbox({ src, alt, onClose }) {
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>&times;</button>
      <img src={src} alt={alt || 'Screenshot'} className="lightbox-image" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}
