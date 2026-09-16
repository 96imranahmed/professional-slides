"""Read saved OOXML to verify paint order, alpha, masks and theme typography."""
import base64
import io
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from lxml import etree
from PIL import Image
from pptx import Presentation
from pptx.oxml.ns import qn
from node_probe import ROOT

sys.path.insert(0,str(ROOT/'skills/professional-slides/runtime/emit'))
from emit_pptx import Emitter


def scene_fixture():
    frame={'x':100,'y':180,'width':800,'height':400}
    image=io.BytesIO();Image.new('RGB',(30,30),'blue').save(image,format='PNG')
    def rect(name,color,opacity=1):
        return {'id':name,'type':'rect','role':'section-surface','frame':frame,'style':{'fill':color,'opacity':opacity}}
    return {'typography':{'body':'Georgia','display':'Arial'},'tokens':{},'slides':[{'id':'one','tokens':{},'nodes':[
        rect('background','#EEEEEE'),
        {'id':'plot','type':'rect','role':'chart-mark','frame':frame,'data':{'componentInstance':'chart'},'style':{'fill':'#000000'}},
        rect('later-overlay','#FF0000',.72),
        {'id':'portrait','type':'image','frame':{'x':950,'y':180,'width':80,'height':80},'data':{'dataUri':'data:image/png;base64,'+base64.b64encode(image.getvalue()).decode(),'circular':True,'crop':{'left':.1,'right':.1}}},
    ],'componentInstances':[{'instanceId':'chart','component':'chart.column','frame':frame,'nativeChart':{
        'type':'column','frame':frame,'categories':['A','B'],'series':[{'name':'Sales','values':[1,2]}],'dataLabels':True,'legend':True,'valueFormat':{'decimals':1}}}]}]}


class ExportReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.path=Path(cls.tmp.name)/'review.pptx'
        Emitter(scene_fixture()).run(cls.path)
        cls.prs=Presentation(cls.path)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_native_chart_sits_between_earlier_and_later_surfaces(self):
        names=[s.name for s in self.prs.slides[0].shapes]
        self.assertLess(names.index('ps:background'),names.index('ps:chart:chart'))
        self.assertLess(names.index('ps:chart:chart'),names.index('ps:later-overlay'))

    def test_rectangle_fill_keeps_alpha(self):
        shape=next(s for s in self.prs.slides[0].shapes if s.name=='ps:later-overlay')
        alpha=shape._element.find('.//'+qn('a:alpha'))
        self.assertEqual(alpha.get('val'),'72000')

    def test_picture_keeps_oval_geometry_and_crop(self):
        pic=next(s for s in self.prs.slides[0].shapes if s.name=='ps:portrait')
        self.assertEqual(pic._element.spPr.find(qn('a:prstGeom')).get('prst'),'ellipse')
        self.assertAlmostEqual(pic.crop_left,.1)
        self.assertAlmostEqual(pic.crop_right,.1)

    def test_theme_keeps_distinct_display_and_body_fonts(self):
        with zipfile.ZipFile(self.path) as archive:
            root=etree.fromstring(archive.read('ppt/theme/theme1.xml'))
        ns={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
        self.assertEqual(root.find('.//a:majorFont/a:latin',ns).get('typeface'),'Arial')
        self.assertEqual(root.find('.//a:minorFont/a:latin',ns).get('typeface'),'Georgia')

    def test_native_chart_inherits_resolved_body_font(self):
        chart=next(s.chart for s in self.prs.slides[0].shapes if s.has_chart)
        self.assertEqual(chart.font.name,'Georgia')
        self.assertEqual(chart.plots[0].data_labels.number_format,'0.0')
