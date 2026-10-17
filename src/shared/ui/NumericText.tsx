import { Children, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";

/** Les chiffres inclus dans une phrase gardent leur taille et leur couleur.
 * Transformation du rendu uniquement : aucune mutation du texte ou du DOM. */
export function numericText(children: ReactNode): ReactNode {
  return Children.map(children, (child): ReactNode => {
    if (typeof child === "number") return <span className="tv-num">{child}</span>;
    if (typeof child === "string")
      return child
        .split(/([+−-]?[€$£¥]?\p{Nd}+(?:[.,:/\u00a0\u066b\u066c]\p{Nd}+)*(?:[%٪€$£¥])?)/gu)
        .map((part, i) =>
          /\p{Nd}/u.test(part) ? (
            <span className="tv-num" key={i}>
              {part}
            </span>
          ) : (
            part
          ),
        );
    if (
      isValidElement<{ children?: ReactNode; className?: string }>(child) &&
      child.props.children != null
    ) {
      if (child.props.className?.includes("tv-num")) return child;
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
        children: numericText(child.props.children),
      });
    }
    return child;
  });
}
