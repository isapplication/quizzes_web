import { isRemoved, PICTURE_REMOVED, type ShownPicture } from "@/lib/media";

/**
 * A question's, an answer's or a slide's picture, wherever it is shown (live screens, the assignment page, the quiz page).
 * It always has its description ({@code alt}); the width and height the server sends reserve its space before the file
 * arrives, so nothing jumps; {@code object-fit: contain} shows all of it, never cropped. The question's own picture is
 * the page's most important image, so it asks for high priority; answer pictures load as usual. A picture that was
 * removed (decision O3) keeps its place and shows "Picture removed" with its description, so a picture-only answer
 * still has its words.
 */
export function Picture({ picture, className = "", main = false }: {
  picture: ShownPicture | null | undefined;
  className?: string;
  /** The question's own picture (the likely largest thing on screen), not an answer's. */
  main?: boolean;
}) {
  if (!picture) return null;
  if (isRemoved(picture)) {
    const ratio = picture.width && picture.height ? `${picture.width} / ${picture.height}` : undefined;
    return (
      <span className={"q-picture picture-removed " + className} style={ratio ? { aspectRatio: ratio } : undefined}>
        <span className="picture-removed-label">{PICTURE_REMOVED}</span>
        {picture.alt && <span className="picture-removed-alt">{picture.alt}</span>}
      </span>
    );
  }
  return (
    // A signed same-origin address that the API serves with its own caching: next/image would only re-process it.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={"q-picture " + className} src={picture.url} alt={picture.alt} decoding="async"
         width={picture.width ?? undefined} height={picture.height ?? undefined}
         fetchPriority={main ? "high" : undefined} />
  );
}
