"""What an exhibit plots, for the rule that every plotted number names its measure (dependency_gates BASIS_MISSING).

A deck's risk map - six threats placed on likelihood against margin at risk -
was refused for "plotting six numbers" that no insight could hold, and a map
whose markers only placed cities was refused the same way. A zone matrix's
positions are judgements on judged axes, and a marker's coordinates say where
it is, not how much: neither is a measurement. A marker's value still is.
"""
import unittest

from node_probe import run_node


class JudgedPositionTests(unittest.TestCase):
    def test_judged_positions_and_bare_markers_plot_nothing_and_a_valued_marker_plots_its_value(self):
        result = run_node("""
import { plottedValues } from './skills/professional-slides/runtime/evidence.mjs';
const zone = { type: 'zone-matrix', xAxis: { label: 'Likelihood by 2030' }, yAxis: { label: 'Margin at risk' }, points: [{ label: 'Fuel spike', x: 0.8, y: 0.85 }, { label: 'Low-cost carriers', x: 0.6, y: 0.22 }] };
const places = { type: 'map', geography: 'region:europe', markers: [{ label: 'London Heathrow', latitude: 51.47, longitude: -0.45 }, { label: 'Istanbul', latitude: 41.26, longitude: 28.74 }] };
const valued = { ...places, markers: places.markers.map((m, i) => ({ ...m, value: [84.5, 84.4][i] })) };
const scatter = { type: 'chart.scatter', points: [{ name: 'A', x: 1, y: 2 }, { name: 'B', x: 3, y: 4 }] };
console.log(JSON.stringify({ zone: plottedValues(zone), places: plottedValues(places), valued: plottedValues(valued), scatter: plottedValues(scatter) }));
""")
        self.assertEqual(result, {"zone": 0, "places": 0, "valued": 2, "scatter": 4})


if __name__ == "__main__":
    unittest.main()
