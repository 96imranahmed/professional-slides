"""One probe page per design style the skill claims to draw.

    python3 evals/corpus/styles/build_probes.py
    node evals/corpus/styles/run_probes.mjs

A style counts as covered only when its probe composes. Where the gallery deck
already has a page of that style it is reused as it stands; otherwise the page
is authored here with the smallest realistic content that shows the style.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path

HERE = Path(__file__).parent
SKILL = HERE.parents[2] / "skills" / "professional-slides"
GALLERY = json.loads((SKILL / "examples" / "gallery-acceptance.deck.json").read_text())["slides"]
CAPABILITY = json.loads((HERE / "capability.json").read_text())["styles"]

P = [{"lead": "The reading.", "text": "A developed point that says what follows from the exhibit and what it costs."}]


def gallery(i):
    return copy.deepcopy(GALLERY[i])


def page(title, **rest):
    return {"title": title, **rest}


T3 = ["Segment", "2024", "2025"]
ROWS = [["Enterprise", "412", "498"], ["Mid-market", "338", "351"], ["Small business", "121", "140"]]

PROBES = {
    "C-stack": gallery(26), "C-col": gallery(2), "C-bar-h": gallery(1), "C-line": gallery(27),
    "C-waterfall": gallery(28), "C-map": gallery(30), "C-pie": gallery(51), "C-combo": gallery(32),
    "C-area": gallery(45), "C-bubble": gallery(49), "C-scatter": gallery(48), "C-lollipop": gallery(39),
    "C-dot-plot": gallery(40),
    "C-small-multiples": page("Four markets move the same way on one scale", layout="exhibit-full", exhibit={
        "type": "chart-group", "charts": [
            {"heading": m, "component": "chart.column",
             "props": {"categories": ["2022", "2023", "2024"], "series": [{"name": m, "values": v}]}}
            for m, v in (("North", [4, 6, 8]), ("South", [3, 5, 6]), ("East", [2, 4, 7]), ("West", [5, 5, 6]))]}),
    "C-paired": page("Volume rose while price held", layout="two-up", exhibits=[
        {"type": "chart.column", "heading": "Units sold", "unit": "m",
         "categories": ["2022", "2023", "2024"], "series": [{"name": "Units", "values": [4, 6, 8]}]},
        {"type": "chart.line", "heading": "Average price", "unit": "$",
         "categories": ["2022", "2023", "2024"], "series": [{"name": "Price", "values": [20, 21, 21]}]}], points=P),
    "C-shared-rows": page("Three measures on the same five regions", layout="exhibit-full", exhibit={
        "type": "table", "columns": [{"label": "Region"}, {"label": "Revenue", "bar": True, "unit": "$m"},
                                     {"label": "Margin", "bar": True, "unit": "%"}, {"label": "Growth", "bar": True, "unit": "%"}],
        "rows": [["North", 42, 18, 6], ["South", 35, 12, 9], ["East", 28, 21, 4], ["West", 19, 9, 11], ["Central", 12, 15, 3]]}),
    "C-radial": page("Firms expect remote work to last more than their staff want it", layout="exhibit-full", exhibit={
        "type": "radial-bars", "items": [{"label": "Firms that think more jobs can be done remotely", "value": 93},
                                          {"label": "Firms that say they will cut business travel", "value": 91},
                                          {"label": "Employees who want to work from home more often", "value": 77, "highlight": True}]}),
    "C-waffle": page("Institutions ranking each factor first", layout="exhibit-full", exhibit={
        "type": "chart.waffle", "heading": "Institutions ranking each factor first", "unit": "Number of institutions",
        "categories": ["Productivity", "Business needs", "Compliance", "Return"], "series": [{"name": "Institutions", "values": [16, 15, 8, 5]}]}),
    "C-bubble-grid": page("Most use cases are still at ideation", layout="exhibit-full", exhibit={
        "type": "chart.bubble-grid", "heading": "Use cases by institution type and stage", "unit": "use cases",
        "rows": ["Mega banks", "Regionals", "Other"], "columns": ["Ideation", "Pilot", "Deployed"],
        "values": [[30, 9, 4], [15, 12, 6], [8, 9, 4]]}),
    "T-text": gallery(4), "T-plain": page("Revenue by segment", layout="exhibit-top", exhibit={
        "type": "table", "columns": T3, "rows": ROWS}, points=P),
    "T-bars": page("Enterprise carries the growth", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Segment", {"label": "2025", "bar": True, "unit": "$m"}],
        "rows": [["Enterprise", 498], ["Mid-market", 351], ["Small business", 140]]}, points=P),
    "T-heat": page("Scores by vendor and criterion", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Criterion", {"label": "A", "heat": True}, {"label": "B", "heat": True}],
        "rows": [["Fit", "3", "5"], ["Cost", "4", "2"], ["Risk", "2", "4"]]}, points=P),
    "T-rag": page("Two workstreams are behind", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Workstream", "Owner", "Status"],
        "rows": [["Data", "Finance", "On track"], ["Platform", "IT", "At risk"], ["Adoption", "HR", "Behind"]]}, points=P),
    "T-check": page("Only one vendor meets every requirement", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Requirement", "A", "B"],
        "rows": [["Security", "✓", "✗"], ["Scale", "✓", "✓"], ["Cost", "✗", "✓"]]}, points=P),
    "T-harvey": page("Vendor B leads on fit", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Criterion", "A", "B"],
        "rows": [["Fit", {"type": "harvey", "value": 2}, {"type": "harvey", "value": 4}],
                 ["Integration", {"type": "harvey", "value": 3}, {"type": "harvey", "value": 1}]]}, points=P),
    "T-bubble": page("Returns by market", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Market", {"label": "IRR", "unit": "%", "bubble": True}],
        "rows": [["Germany", "19.4"], ["France", "17.2"], ["Poland", "15.1"]]}, points=P),
    "T-icon-rows": page("Three drivers, each with its own owner", layout="exhibit-top", exhibit={
        "type": "table", "columns": ["Driver", "Evidence", "Owner"],
        "rows": [[{"text": "Pricing", "icon": "money"}, "Discounts rose 4 points", "Sales"],
                 [{"text": "Churn", "icon": "people"}, "Renewals fell to 88%", "Success"],
                 [{"text": "Cost", "icon": "gear"}, "Unit cost up 6%", "Operations"]]}, points=P),
    "T-profile": page("The company at a glance", layout="stack", exhibits=[
        {"type": "table", "heading": "Business overview", "columns": ["Item", "Value"],
         "rows": [["Founded", "1998"], ["Employees", "4,200"], ["Markets", "14"]]},
        {"type": "table", "heading": "Financial summary", "columns": ["$m", "2023", "2024"],
         "rows": [["Revenue", "812", "904"], ["EBITDA", "121", "140"]]}], points=P),
    "D-flow": page("Orders pass three hand-offs", layout="exhibit-full", exhibit={
        "type": "relationship-network", "variant": "directed-spokes", "centerId": "order",
        "nodes": [{"id": "order", "label": "Order"}, {"id": "credit", "label": "Credit check"},
                  {"id": "pick", "label": "Warehouse pick"}, {"id": "ship", "label": "Carrier"}],
        "edges": [{"from": "order", "to": "credit"}, {"from": "order", "to": "pick"}, {"from": "order", "to": "ship"}]}),
    "D-network": gallery(14), "D-hub": gallery(14), "D-cycle": gallery(11), "D-process": gallery(57),
    "D-gantt": gallery(5), "D-matrix": gallery(35), "D-funnel": gallery(59), "D-swimlane": gallery(10),
    "D-curve": gallery(52),
    "D-pyramid": page("Three tiers, and the base carries the rest", layout="exhibit-full", exhibit={
        "type": "framework", "variant": "pyramid", "tiers": [
            {"label": "Purpose", "text": "Why the organisation exists"},
            {"label": "Growth", "text": "Room to develop and be recognised"},
            {"label": "Satisfaction", "text": "Fair pay, fit and a workable environment"},
            {"label": "Foundation", "text": "Basic needs met reliably"}]}),
    "X-document": page("Most of the variance in delivery came from how scope was set", layout="text", paragraphs=["The review covered 42 programmes across four divisions between 2021 and 2024, and asked one question of each: what separated the programmes that delivered what they promised from those that did not. The answer was narrower than the organisation expected. Most of the variance in delivery came from how scope was set before work began, and very little from how the work was then executed.", "Programmes that fixed their scope before funding was released delivered within budget three times as often as those that set scope after money was committed. The difference held in every division and at every size of programme, and it held after allowing for the experience of the team, the technology involved and the sponsor's seniority.", "The mechanism is not mysterious. A programme funded before its scope is fixed negotiates that scope with money already spent, and every argument about what is in and out is settled by adding rather than cutting. A programme whose scope is signed first spends its money against something, and can be measured against it.", "Two further findings follow. Funding released in waves against evidence outperformed annual allocations, because a wave that misses its evidence is stopped rather than extended. And programmes that named a date for switching off the old system finished on average eleven months sooner than those that ran the two in parallel."]),
    "S-backmatter": page("Important notice", layout="text", paragraphs=["The review covered 42 programmes across four divisions between 2021 and 2024, and asked one question of each: what separated the programmes that delivered what they promised from those that did not. The answer was narrower than the organisation expected. Most of the variance in delivery came from how scope was set before work began, and very little from how the work was then executed.", "Programmes that fixed their scope before funding was released delivered within budget three times as often as those that set scope after money was committed. The difference held in every division and at every size of programme, and it held after allowing for the experience of the team, the technology involved and the sponsor's seniority."]),
    "S-contact": page("Contacts for this work", layout="exhibit-full", exhibit={
        "type": "people", "items": [
            {"name": "A. Khan", "role": "Partner, London", "points": ["a.khan@example.com", "+44 20 0000 0000"]},
            {"name": "B. Ortiz", "role": "Principal, Madrid", "points": ["b.ortiz@example.com", "+34 91 000 0000"]},
            {"name": "C. Lee", "role": "Principal, Singapore", "points": ["c.lee@example.com", "+65 6000 0000"]}]}),
    "P-case-study": page("A regional bank cut onboarding from nine days to two", layout="text",
        photo={"path": "assets/harbour.jpg", "alt": "Branch", "credit": "examples/assets"}, pointsStyle="prose", points=[
            {"lead": "Situation.", "text": "Account opening took nine days and lost a third of applicants before the first deposit."},
            {"lead": "Approach.", "text": "Identity checks moved to the first screen; the manual review queue was retired."},
            {"lead": "Impact.", "text": "Onboarding fell to two days and completed applications rose by 28%."}]),
    "T-logo-rows": page("Four partners, four roles", layout="exhibit-top", exhibit={
        "type": "table", "columns": [{"label": "Partner", "type": "logo"}, "Role", "Since"],
        "rows": [[{"media": {"path": "assets/hills.jpg", "alt": "Northwind", "credit": "examples/assets"}}, "Payment network", "2019"],
                 [{"media": {"path": "assets/harbour.jpg", "alt": "Contoso", "credit": "examples/assets"}}, "Card issuing", "2021"],
                 [{"media": {"path": "assets/terraces.jpg", "alt": "Fabrikam", "credit": "examples/assets"}}, "Fraud screening", "2022"]]}, points=P),
    "T-photo-rows": page("Three components of autonomous haulage", layout="exhibit-top", exhibit={
        "type": "table", "columns": [{"label": "Component", "type": "category"}, {"label": "", "type": "photo", "width": {"px": 110}}, "What it does"],
        "rows": [[{"text": "Vehicle kit", "type": "category"}, {"media": {"path": "assets/hills.jpg", "alt": "Truck", "credit": "examples/assets"}}, "Sensors, control software and radio on each truck"],
                 [{"text": "Site network", "type": "category"}, {"media": {"path": "assets/harbour.jpg", "alt": "Mast", "credit": "examples/assets"}}, "High-capacity wireless across the pit"],
                 [{"text": "Control centre", "type": "category"}, {"media": {"path": "assets/terraces.jpg", "alt": "Control room", "credit": "examples/assets"}}, "Remote supervision of the fleet"]]}, points=P),
    "X-columns": gallery(22), "X-cards": gallery(21),
    "K-stat-list": page("Most managers see wellbeing as their job; few are recognised for it", layout="exhibit-full", exhibit={
        "type": "cards", "tone": "stat", "items": [
            {"value": "87%", "title": "say supporting employee wellbeing is part of their job", "text": "Up from 71% in 2021"},
            {"value": "70%", "title": "say their organisation expects them to do it", "text": "The expectation is set but not resourced"},
            {"value": "1 in 4", "title": "companies formally recognise the work", "text": "In performance reviews or promotion criteria"}]}),
    "X-numbered-rows": page("Three moves, in order", layout="text", pointsStyle="numbered", points=[
        {"lead": "Fix the scope.", "text": "Before funding, so delivery is measured against something."},
        {"lead": "Fund in waves.", "text": "Release money against evidence rather than on a calendar."},
        {"lead": "Retire the old system.", "text": "On a date, so the two do not run in parallel for years."}]),
    "X-icon-list": page("Three risks, each with an owner", layout="text", pointsStyle="icon-lead", points=[
        {"lead": "Security.", "text": "Access reviews are quarterly and should be monthly.", "icon": "shield"},
        {"lead": "People.", "text": "Two roles have no successor named.", "icon": "people"},
        {"lead": "Cost.", "text": "Cloud spend is up 30% with no owner.", "icon": "money"}]),
    "X-bullets": page("What the board asked for", layout="text", points=[
        {"text": "A single view of programme status across divisions."},
        {"text": "A funding gate that releases money against evidence."},
        {"text": "A date by which the old platform is switched off."}]),
    "X-checklist": page("Six questions before funding", layout="text", pointsStyle="check", points=[
        {"text": "Is the scope fixed and signed?"}, {"text": "Is there a named owner?"},
        {"text": "Is the benefit measured before and after?"}]),
    "X-quote": page("Customers name price and reliability first", layout="exhibit-full", exhibit={
        "type": "quote-cluster", "quotes": [
            {"quote": "We would pay more for a service that simply turned up on time.", "attribution": "Operations director", "detail": "Retail"},
            {"quote": "Price matters, but a missed delivery costs us more than the discount saves.", "attribution": "Procurement lead", "detail": "Manufacturing"}]}),
    "X-statement": {"kind": "statement", "title": "Scope set before funding is the single largest driver of delivery."},
    "X-exec": page("Most variance comes from how scope is set", role="executive-summary", layout="text", points=P * 3),
    "X-before-after": gallery(18),
    "X-labeled-rows": page("Four stages, each with its own test", layout="exhibit-full", exhibit={
        "type": "table", "treatment": "categories",
        "columns": [{"label": "Stage", "type": "category"}, "What has to be true"],
        "rows": [["Assess", "The baseline is measured"], ["Design", "The scope is fixed and signed"],
                 ["Build", "Each wave has a funding gate"], ["Run", "The old system has a switch-off date"]]}),
    "K-ring": page("Three rates the programme is judged on", layout="metrics-over-exhibit", metricsTone="ring",
                   metrics=[{"value": "74%", "label": "on budget"}, {"value": "61%", "label": "on time"}, {"value": "88%", "label": "adopted"}],
                   exhibit={"type": "chart.column", "heading": "Programmes delivered on budget", "unit": "%",
                            "categories": ["2022", "2023", "2024"], "series": [{"name": "On budget", "values": [52, 63, 74]}]}),
    "K-tiles": page("Four numbers from the review", layout="metrics-over-exhibit",
                    metrics=[{"value": "42", "label": "programmes"}, {"value": "4", "label": "divisions"},
                             {"value": "3x", "label": "more often on budget"}, {"value": "$1.2bn", "label": "reviewed"}],
                    exhibit={"type": "chart.bar", "heading": "Programmes by division", "unit": "count",
                             "categories": ["Retail", "Wholesale", "Digital", "Corporate"], "series": [{"name": "Count", "values": [14, 11, 10, 7]}]}),
    "P-people": gallery(20), "P-logos": gallery(62), "S-divider": gallery(0),
    "S-agenda": {"kind": "agenda", "title": "Contents", "items": [{"label": "Findings"}, {"label": "Options"}, {"label": "Next steps"}]},
    "P-photo-full": {"kind": "statement", "title": "The northern plot is the only one with road access in place.",
                     "image": {"path": "assets/hills.jpg", "alt": "Hills at dusk", "credit": "examples/assets"}},
    "P-photo-text": page("The harbour frontage is the constraint", layout="text",
                         photo={"path": "assets/harbour.jpg", "alt": "Harbour at dusk", "credit": "examples/assets"}, points=P * 2),
    "P-photo-tiles": page("Three sites under review", layout="picture-strip", pictures=[
        {"path": "assets/hills.jpg", "credit": "examples/assets", "label": "Northern plot", "text": "Road access in place"},
        {"path": "assets/harbour.jpg", "credit": "examples/assets", "label": "Harbour", "text": "Flood risk to resolve"},
        {"path": "assets/terraces.jpg", "credit": "examples/assets", "label": "Terraces", "text": "Planning consent pending"}]),
    "P-illustration": page("The site in context", layout="text",
                           photo={"path": "assets/terraces.jpg", "alt": "Terraced hillside", "credit": "examples/assets"}, points=P * 2),
    "P-screenshot": page("The new portal", layout="text",
                         photo={"path": "assets/harbour.jpg", "alt": "Portal screenshot", "credit": "examples/assets"}, points=P * 2),
    "X-personas": page("Three customer types", layout="exhibit-full", exhibit={
        "type": "icon-trends", "variant": "image-columns", "items": [
            {"id": "a", "title": "The planner", "text": "Books months ahead and compares on price.", "media": {"path": "assets/hills.jpg", "alt": "Planner", "credit": "examples/assets"}},
            {"id": "b", "title": "The traveller", "text": "Books late and values flexibility.", "media": {"path": "assets/harbour.jpg", "alt": "Traveller", "credit": "examples/assets"}},
            {"id": "c", "title": "The regular", "text": "Books the same route every month.", "media": {"path": "assets/terraces.jpg", "alt": "Regular", "credit": "examples/assets"}}]}),
    "D-staircase": page("Four stages of maturity", layout="exhibit-full", exhibit={
        "type": "chart.horizons", "variant": "stepped", "horizons": [
            {"id": "h1", "label": "Nascent", "title": "Manual", "description": "Spreadsheets and email"},
            {"id": "h2", "label": "Emerging", "title": "Tooled", "description": "One system of record"},
            {"id": "h3", "label": "Progressive", "title": "Integrated", "description": "Shared data across teams"},
            {"id": "h4", "label": "Pioneer", "title": "Automated", "description": "Decisions made in the flow"}]}),
}

PROBES.update({
    "K-stat-list": page("Managers see wellbeing as their job; few are recognised for it", layout="exhibit-left",
        exhibit={"type": "stat-list", "tone": "dark", "items": [
            {"value": "87%", "text": "of managers say supporting employee wellbeing is part of their job"},
            {"value": "70%", "text": "say their organisation expects it of them"},
            {"value": "1 in 4", "text": "companies formally recognise the work in reviews or promotion"}]},
        points=[{"lead": "The expectation is set and the reward is not.", "text": "Most managers accept the job; three companies in four do not count it when they decide who is promoted."}]),
    "D-flow": page("An order passes three checks before it ships, and two can send it back", layout="exhibit-full", exhibit={
        "type": "flow", "nodes": [
            {"id": "order", "label": "Order received"}, {"id": "credit", "label": "Credit check", "text": "Automated, 2 minutes"},
            {"id": "stock", "label": "Stock check", "text": "Warehouse system"}, {"id": "manual", "label": "Manual review", "tone": "accent", "text": "Averages 2 days"},
            {"id": "pick", "label": "Pick and pack"}, {"id": "ship", "label": "Dispatched"}],
        "edges": [{"from": "order", "to": "credit"}, {"from": "order", "to": "stock"}, {"from": "credit", "to": "manual", "label": "flagged"},
                  {"from": "credit", "to": "pick"}, {"from": "stock", "to": "pick"}, {"from": "manual", "to": "ship"}, {"from": "pick", "to": "ship"}]},
        soWhat="One order in eight reaches manual review, and it accounts for most of the delay."),
    "D-spectrum": page("Leaders sit nearer growth than fixed on every dimension but one", layout="exhibit-full", exhibit={
        "type": "spectrum", "items": [
            {"left": "Fixed", "right": "Growth", "value": 0.72, "text": "How can this challenge be an opportunity to learn?"},
            {"left": "Expert", "right": "Curious", "value": 0.58, "text": "What would I ask if I knew nothing about this?"},
            {"left": "Reactive", "right": "Creative", "value": 0.31, "text": "What is the bigger 'why' I am solving for?"}]}),
    "D-layers": page("Every capability rests on one data platform", layout="exhibit-full", exhibit={
        "type": "layers", "layers": [
            {"label": "Customer experience", "text": "Apps, portals and the contact centre"},
            {"label": "Business services", "text": "Pricing, fulfilment and billing"},
            {"label": "Integration", "text": "APIs and event streams between systems"},
            {"label": "Data platform", "text": "One customer and product record for every layer above"}]}),
    "D-kanban": page("Most sectors face a setback; five accelerate", layout="exhibit-full", exhibit={
        "type": "placement", "columns": [{"label": "Temporary setback", "icon": "chart-line"}, {"label": "Continued growth", "icon": "growth"}, {"label": "Accelerated", "icon": "target"}],
        "items": [{"label": "Transport", "column": 0}, {"label": "Online travel", "column": 0}, {"label": "Food delivery", "column": 1},
                  {"label": "Online media", "column": 1}, {"label": "E-commerce", "column": 2, "highlight": True}, {"label": "Payments", "column": 2}, {"label": "Remittance", "column": 2}]}),
    "C-bump": page("China rose from sixth to first in fifteen years", layout="exhibit-full", exhibit={
        "type": "rank-flow", "periods": ["1990", "2000", "2010", "2012"], "highlight": ["China", "India"],
        "entities": [{"name": "United States", "ranks": [1, 1, 2, 2]}, {"name": "Japan", "ranks": [2, 2, 3, 3]},
                     {"name": "Germany", "ranks": [3, 3, 4, 4]}, {"name": "Italy", "ranks": [4, 5, 6, 6]},
                     {"name": "United Kingdom", "ranks": [5, 4, 7, 7]}, {"name": "China", "ranks": [6, 6, 1, 1]},
                     {"name": "India", "ranks": [7, 7, 5, 5]}]}),
    "C-sankey": page("Most loan-officer roles move into underwriting", layout="exhibit-full", exhibit={
        "type": "sankey", "left": [{"id": "lo", "label": "Loan officers"}, {"id": "proc", "label": "Processors"}, {"id": "cs", "label": "Customer service"}],
        "right": [{"id": "uw", "label": "Underwriting"}, {"id": "adv", "label": "Advisers"}, {"id": "ops", "label": "Operations"}],
        "flows": [{"from": "lo", "to": "uw", "value": 40}, {"from": "lo", "to": "adv", "value": 25}, {"from": "proc", "to": "ops", "value": 30},
                  {"from": "proc", "to": "uw", "value": 10}, {"from": "cs", "to": "adv", "value": 20}, {"from": "cs", "to": "ops", "value": 15}],
        "highlight": ["lo"]}),
    "C-pictogram": page("Six in ten employees self-identify as allies; one in ten acts on it", layout="exhibit-full", exhibit={
        "type": "pictogram", "of": 10, "rows": [
            {"label": "Self-identify as allies", "value": 6, "text": "63% of employees surveyed"},
            {"label": "Take consistent action", "value": 1, "text": "10% of employees surveyed"}]}),
    "D-arrows": page("Two paths for customers, and only one keeps them", layout="exhibit-full", exhibit={
        "type": "arrow-rows", "items": [
            {"label": "Green customers stay", "icon": "people", "text": "They continue to bank with the bank they trust and switch to its sustainable products."},
            {"label": "Green customers leave", "icon": "chart-line", "text": "They switch to a more sustainable bank, taking deposits and the relationship with them."}]}),
    "X-capsules": page("Three priorities for the budget", layout="exhibit-full", exhibit={
        "type": "capsules", "items": [
            {"title": "Stimulate domestic demand", "text": "Targeted relief for households", "icon": "people"},
            {"title": "Accelerate public investment", "text": "Infrastructure brought forward", "icon": "building"},
            {"title": "Cultivate fiscal prudence", "text": "Debt stabilised by 2027", "icon": "shield"}]}),
})

PROBES.update({
    "X-sidebar": page("Where is quantum computing headed?", layout="sidebar",
        panel={"text": "Most of the value arrives after 2030, and the race to get there is already being decided."},
        points=[{"lead": "Leadership is still open.", "text": "Photonic, trapped-ion and superconducting approaches each lead on a different measure, and none has a lead that holds across all of them."},
                {"lead": "Investment is concentrating.", "text": "The largest rounds of the last three years went to fewer than ten companies, most of them building hardware."},
                {"lead": "Governments are buying in.", "text": "National programmes now fund a third of the work, which ties the race to industrial policy as much as to the science."}]),
    "K-infographic": page("The report in numbers", layout="exhibit-full", exhibit={
        "type": "fact-grid", "tone": "dark", "items": [
            {"value": "63m", "label": "article reads", "text": "Across the site and partners in 2024", "icon": "search"},
            {"value": "1,200+", "label": "reports published", "text": "Research and survey work", "icon": "checklist"},
            {"value": "47", "label": "industry awards", "icon": "target"},
            {"value": "5,000+", "label": "cited articles", "text": "Referenced in outside work", "icon": "chart-line"},
            {"value": "78%", "label": "reader satisfaction", "gauge": 0.78, "icon": "people"},
            {"value": "1,500", "label": "authors", "text": "Across 65 countries", "icon": "globe"}]}),
    "C-over-photo": page("Connected devices will outnumber people ten to one by 2025", layout="photo-backdrop",
        photo={"path": "assets/harbour.jpg", "alt": "City at dusk", "credit": "examples/assets"},
        exhibit={"type": "chart.column", "heading": "Connected devices and population", "unit": "bn",
                 "categories": ["2003", "2010", "2015", "2025"],
                 "series": [{"name": "Connected devices", "values": [0.5, 12.5, 25, 50]}]}),
    "D-zone-matrix": page("Two risks sit in the highest zone and one of them has no owner", layout="exhibit-full", exhibit={
        "type": "zone-matrix", "xAxis": {"label": "Likelihood", "low": "Rare", "high": "Likely"},
        "yAxis": {"label": "Impact", "low": "Minor", "high": "Severe"}, "zoneLabels": {"low": "Monitor", "high": "Act now"},
        "points": [{"label": "Supplier insolvency", "x": 0.82, "y": 0.86, "highlight": True}, {"label": "Data breach", "x": 0.55, "y": 0.9},
                   {"label": "Key-person loss", "x": 0.7, "y": 0.5}, {"label": "Regulatory change", "x": 0.3, "y": 0.65},
                   {"label": "Currency swing", "x": 0.6, "y": 0.25}]}),
    "P-device-mockup": page("The new portal puts the claim status on the first screen", layout="exhibit-left",
        exhibit={"type": "device-frame", "device": "laptop", "image": {"path": "assets/harbour.jpg", "alt": "Portal home screen", "credit": "examples/assets"}},
        points=[{"lead": "Status first.", "text": "The claim's stage and the next action sit above the fold."},
                {"lead": "One login.", "text": "Policy, claims and payments share a single account."}]),
    "X-checklist": page("Six questions before a programme is funded", layout="text", pointsStyle="checklist", points=[
        {"text": "Is the scope fixed and signed by the sponsor?"}, {"text": "Is there one named owner for delivery?"},
        {"text": "Is the benefit measured before work starts?", "state": "yes"}, {"text": "Is funding released in waves against evidence?"},
        {"text": "Is there a date to switch off the old system?"}, {"text": "Is the stopping condition written down?", "state": "no"}]),
    "X-worksheet": page("Problem statement worksheet", layout="exhibit-full", exhibit={
        "type": "worksheet", "columns": 3, "fields": [
            {"label": "Problem question", "prompt": "The basic question to be resolved, in one sentence", "span": 3},
            {"label": "Context", "prompt": "What makes this a problem now?"}, {"label": "Criteria for success", "prompt": "How will we know it is solved?"},
            {"label": "Constraints", "prompt": "What cannot change?"}, {"label": "Stakeholders", "prompt": "Who decides, who is affected?"},
            {"label": "Scope", "prompt": "What is in and out?"}, {"label": "Sources of insight", "prompt": "Where will the evidence come from?"}]}),
    "X-speech-bubbles": page("The barriers to experimentation are cultural before they are technical", layout="exhibit-full", exhibit={
        "type": "speech", "items": [
            {"speaker": "Fred Mills", "role": "Head of marketing", "quote": "I'm not interested in holdout groups. I'm interested in personalisation, and I can't approve experiments that alienate my loyal customers."},
            {"speaker": "Donna Reyes", "role": "Data science lead", "quote": "Not being able to test something directly is common in science. Let me show you how we use the same techniques here."},
            {"speaker": "Mark Chen", "role": "Product manager", "quote": "Causal inference and off-policy evaluation would let us learn from what we already do."}]}),
})


def main():
    slides, missing = [], []
    for style, via in CAPABILITY.items():
        if style.startswith("$") or not via:
            continue
        if style not in PROBES:
            missing.append(style); continue
        slide = copy.deepcopy(PROBES[style])
        slide["id"] = style.lower()
        slides.append(slide)
    deck = {"schema": "professional-slides.deck/v3", "id": "style-probes", "contents": False, "slides": slides}
    (HERE / "probes.deck.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(slides)} probe pages; claimed styles without a probe: {missing}")


if __name__ == "__main__":
    main()
