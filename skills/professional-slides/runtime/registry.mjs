// The component registry: every component the layout engine can place, by
// id, registered family by family. The core families live in registry-*.mjs
// and share registry-shared.mjs; the rest register from their own modules.
//
//   registry-chrome.mjs        slide chrome, page template, sections, titles, cover, divider, footers
//   registry-text.mjs          paragraph, bullet list, insight, callout, evidence note, panel
//   registry-data.mjs          metric, legend, chart callout, the tables, status list
//   registry-media.mjs         image frame, icon, logo; their photographs; icon trends, logo collage
//   registry-process.mjs       process, roadmap and tree
//   registry-diagrams.mjs      matrix, map, funnel
//   registry-connectors.mjs    the connector between columns and the content rail
//   registry-chart-title.mjs   the heading every chart draws
import { registerChrome } from "./registry-chrome.mjs";
import { registerTextBlocks } from "./registry-text.mjs";
import { registerDataBlocks } from "./registry-data.mjs";
import { registerMediaBlocks, registerMedia } from "./registry-media.mjs";
import { registerProcessFamily } from "./registry-process.mjs";
import { registerDiagrams } from "./registry-diagrams.mjs";
import { registerConnectors } from "./registry-connectors.mjs";
import { registerChartTitle } from "./registry-chart-title.mjs";
import { registerTrackers } from "./trackers.mjs";
import { registerInsightTreeTable } from "./insight-tree-table.mjs";
import { registerQuoteCluster } from "./quote-cluster.mjs";
import { registerCharts } from "./charts.mjs";
import { registerChartGroup } from "./chart-group.mjs";

import { registerSegmentedEvidence } from "./segmented-evidence.mjs";
import { registerRelationshipNetwork } from "./relationship-network.mjs";
import { registerPanels } from "./panels.mjs";
import { registerExtras } from "./extras.mjs";
import { registerGantt } from "./gantt.mjs";
import { registerFramework } from "./framework.mjs";
import { registerFigures } from "./figures.mjs";

// The registration order is the registry's iteration order - the manifest,
// the component samples, the gallery - so it is fixed here: the core
// families first, then the families that build on them.
const FAMILIES = [registerChrome, registerTextBlocks, registerDataBlocks, registerMediaBlocks, registerProcessFamily, registerDiagrams,
  registerConnectors, registerChartTitle, registerTrackers, registerInsightTreeTable, registerQuoteCluster, registerCharts, registerChartGroup,
  registerMedia, registerSegmentedEvidence, registerRelationshipNetwork, registerPanels, registerExtras, registerGantt, registerFramework, registerFigures];

export function createRegistry() {
  return FAMILIES.reduce((registry, register) => register(registry), new Map());
}

export const REGISTRY = createRegistry();

export function registryManifest() {
  return {
    schema: "professional-slides.component-registry/v1",
    components: [...REGISTRY.values()].map((definition) => ({
      id: definition.id,
      version: definition.version,
      category: definition.category,
      role: definition.role,
      ...(definition.variants ? { variants: definition.variants, defaultVariant: definition.defaultVariant, variantProp: definition.variantProp } : {}),
      ...(definition.examples ? { examples: definition.examples } : {}),
      tokens: definition.tokens,
      preferredSize: definition.preferredSize,
      sample: definition.sample,
      ...(definition.guidance ? { guidance: definition.guidance } : {})
    }))
  };
}
