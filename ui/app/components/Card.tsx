import { Link as RouterLink } from "react-router-dom";
import React from "react";

type CardProps = {
  /** Absolute or relative link for the Card */
  href: string;
  /** The src for the image to show. */
  imgSrc: string;
  /** The name for the Card to show below the image. */
  name: string;
  /** Is the link target in the app? default: false */
  inAppLink?: boolean;
};

export const Card = ({ href, inAppLink, imgSrc, name }: CardProps) => {
  const content = (
    <div className="custom-card-content">
      <img src={imgSrc} alt={name} height="100px" width="100px" />
      <span>{name}</span>
    </div>
  );

  if (inAppLink) {
    return (
      <RouterLink className="custom-card" to={href}>
        {content}
      </RouterLink>
    );
  }

  return (
    <a className="custom-card" href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
};
