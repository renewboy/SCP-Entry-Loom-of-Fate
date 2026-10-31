import React from 'react';

interface EntityPortraitProps {
  src: string;
  /** "Appendix A"; hidden on small thumbnails where only the designation fits */
  appendix: string;
  designation: string;
  id?: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

/** The SCP's portrait: sepia filter and an appendix label in the corner, wherever it appears */
const EntityPortrait: React.FC<EntityPortraitProps> = ({ src, appendix, designation, id, className = '', title, onClick }) => {
  const content = (
    <>
      <img src={src} alt={designation} />
      <span className="ent-cap"><span className="ent-cap-app">{appendix} // </span>{designation}</span>
    </>
  );
  return onClick
    ? <button type="button" id={id} className={`entity-portrait ${className}`} title={title} onClick={onClick}>{content}</button>
    : <figure id={id} className={`entity-portrait ${className}`}>{content}</figure>;
};

export default EntityPortrait;
