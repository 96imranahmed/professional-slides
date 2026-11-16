// The suite reads slides through the runtime's own HTML emitter, set at actual size.
import { deckHtml } from "../../skills/professional-slides/runtime/emit/emit_html.mjs";

export const renderSlideHtml = (slide, { title = slide.id } = {}) => deckHtml({ id: title, slides: [slide] }, { title, actual: true });
