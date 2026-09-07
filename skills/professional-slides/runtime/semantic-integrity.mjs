/** Explicit, exportable ownership and dependency tags for every scene object. */
export const SEMANTIC_SCHEMA = 'professional-slides.semantic/v1';
const visible = n => n.type !== 'text' || String(n.text || '').trim();
const sameAnnotation = (a,b) => a.data.annotationKey !== undefined
  ? a.data.annotationKey === b.data.annotationKey
  : a.data.targetCategory === b.data.targetCategory && a.data.targetSeries === b.data.targetSeries;
const requirements = {
  'decision-conclusion': ['decision-conclusion-surface'], 'decision-conclusion-surface': ['decision-conclusion'],
  'evidence-note-body': ['evidence-note-surface'], 'evidence-note-heading': ['evidence-note-surface','evidence-note-body'], 'evidence-note-surface': ['evidence-note-body'],
  'insight-body': ['insight-surface'], 'insight-heading': ['insight-surface','insight-body'],
  'insight-surface': ['insight-body'], 'insight-border-dot': ['insight-surface'],
  'annotation-leader': ['annotation-text'], 'annotation-text': ['annotation-surface'], 'annotation-surface': ['annotation-text'],
  'annotation-endpoint': ['annotation-leader','annotation-text'],
  'metric-value': ['metric-label'], 'metric-label': ['metric-value'], 'metric-delta': ['metric-value','metric-label'],
  'title-rule': ['title','action-title','chart-title','section-heading','section-title'],
};
export function tagSemanticNodes(nodes, instances) {
  for (const node of nodes) {
    const peers = nodes.filter(p => p.id !== node.id && p.data.componentInstance === node.data.componentInstance && visible(p));
    const requiredRoles = node.data.annotationStyle === 'rail-label' ? [] : requirements[node.role] || [];
    const candidates = peers.filter(p => requiredRoles.includes(p.role) && (!node.role.startsWith('annotation-') || sameAnnotation(node,p)));
    const relationship = instances.find(i=>i.instanceId===node.data.componentInstance)?.relationships;
    const relatedOwners = (relationship?.relatedTo || []).map(id=>instances.find(i=>i.id===id)?.instanceId);
    for(const owner of relatedOwners) candidates.push(...nodes.filter(n=>n.data.componentInstance===owner && visible(n)));
    node.data = {...node.data, semantic: {schema:SEMANTIC_SCHEMA,id:node.id,role:node.role,owner:node.data.componentInstance,requires:[...new Set([...candidates.map(p=>p.id), ...(node.data.dependencies || [])])],requiredRoles}};
  }
  assertSemanticIntegrity(nodes, instances);
}
export function assertSemanticIntegrity(nodes, instances) {
  const byId = new Map(nodes.map(n=>[n.id,n]));
  const owners = new Set(instances.map(i=>i.instanceId));
  for (const node of nodes) {
    const s=node.data.semantic;
    if (!s || s.schema!==SEMANTIC_SCHEMA || s.id!==node.id || s.role!==node.role || !owners.has(s.owner)) throw new Error(`Dangling object ${node.id}: missing or invalid semantic tag/owner`);
    if (!Array.isArray(s.requires) || !Array.isArray(s.requiredRoles)) throw new Error(`Dangling object ${node.id}: invalid dependencies`);
    for (const id of s.requires) if (!byId.has(id) || !visible(byId.get(id))) throw new Error(`Dangling object ${node.id}: missing dependency ${id}`);
    if (visible(node) && s.requiredRoles.length) {
      const present = role => s.requires.some(id=>byId.get(id)?.role===role);
      const complete = node.role==='title-rule' ? s.requiredRoles.some(present) : s.requiredRoles.every(present);
      if (!complete) throw new Error(`Dangling ${node.role} ${node.id}: missing ${s.requiredRoles.filter(r=>!present(r)).join('/')}`);
    }
    if (node.role==='annotation-leader' && node.data.annotationTreatment && !s.requires.some(id=>byId.get(id)?.role==='annotation-text')) throw new Error(`Dangling annotation ${node.id}: missing insight text`);
  }
}
/** Generic prose cannot stand in for a detached analytical takeaway. */
export function assertPlanRelationships(plan) {
  function visit(items) {
    const byId=new Map(items.map(i=>[i.id,i]));
    const evidence=items.some(i=>i.component?.startsWith('chart') || ['table','map','process','timeline','tree','metric','insight'].includes(i.component));
    for(const item of items) {
      if(item.items) visit(item.items);
      if(item.component==='evidence-note' && evidence) {
        const relation=item.props?.semantic;
        if(relation?.kind!=='evidence-note' || !relation.relatedTo?.length || relation.relatedTo.some(id=>!byId.has(id) || byId.get(id)===item || !['table','map','process','timeline','tree','metric'].includes(byId.get(id).component) && !byId.get(id).component?.startsWith('chart'))) throw new Error(`Dangling ${item.id}: evidence note requires real exhibit references`);
      }
      if(item.component==='paragraph' && evidence) throw new Error(`Dangling ${item.id}: a heading and paragraph are not a containing component; use evidence-note or insight`);
      if(item.component!=='paragraph' && item.component!=='section-heading') continue;
      const relation=item.props?.semantic;
      if(relation) {
        if(relation.kind!=='section-member' || !Array.isArray(relation.relatedTo) || !relation.relatedTo.length) throw new Error(`Dangling ${item.id}: invalid section-member tag`);
        for(const id of relation.relatedTo) {
          const peer=byId.get(id);
          if(!peer || peer===item || !(item.component==='section-heading' ? ['paragraph','bullet-list','timeline','process','chart-group','table'].includes(peer.component) || peer.component?.startsWith('chart.') : peer.component==='section-heading')) throw new Error(`Dangling ${item.id}: invalid relatedTo ${id}`);
          if(item.frame && peer.frame && Math.abs(item.frame.x-peer.frame.x)>2) throw new Error(`Dangling ${item.id}: section members must align`);
        }
      } else if(evidence) {
        throw new Error(`Dangling ${item.id}: analytical prose/headings require a section-member tag and actual adjacent content; detached synthesis requires insight or a headed bullet section`);
      }
    }
  }
  visit(plan.items || []);
}
