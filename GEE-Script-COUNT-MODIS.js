/* Author: Salvador Antonio Hernández Malavé. MSc Thesis Project for Monitoring & Mapping Swedish wetlands
 *
 * Copyright (c) 2022, Salvador Antonio Hernández Malavé.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Last edited: Apr 11th, 2022. */

/* ----------------------------- User Input --------------------------- */

var START_DATE = '2021-06-01';
var  END_DATE  = '2021-09-01';
var SWEDEN_BBOX = ee.Geometry.Rectangle([10.9,55.1,24.18,69.1]);
Map.addLayer(SWEDEN_BBOX);

/* -------------------------------------------------------------------- */

// per-county count
var sweden_shp = ee.FeatureCollection("users/sa3175he/sweden_shp");
var counties = {
'Stockholms': 1,
'Uppsala': 3,
'Sodermanlands': 4,
'Ostergotlands': 5,
'Jonkopings': 6,
'Kronobergs': 7,
'Kalmar': 8,
'Gotlands': 9,
'Blekinge': 10,
'Skane': 12,
'Hallands': 13,
'VastraGotalands': 14,
'Varmlands': 17,
'Orebro': 18,
'Vastmanlands': 19,
'Dalarnas': 20,
'Gavleborgs': 21,
'Vasternorrlands': 22,
'Jamtlands': 23,
'Vasterbottens': 24,
'Norrbottens': 25
// numbers 2, 11, 15, 16 & 17 missing, don't exist.
};
for (var i in counties){
  var training_region = sweden_shp.filter('LANSKOD == ' + counties[i]);
  var S1IW_coll =  ee.ImageCollection('COPERNICUS/S1_GRD')
                     .filter(ee.Filter.eq('instrumentMode', 'IW'))
                     .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                     .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')) // which should I use??
                     .filter(ee.Filter.date(START_DATE, END_DATE))
                     .filterBounds(training_region)
                     .select('VV') // same result for selecting 1 band and multiple bands
  ;
  var S2_coll = ee.ImageCollection('COPERNICUS/S2_SR')
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20)) // Pre-filter to get less cloudy granules.
                  .filterDate(START_DATE, END_DATE)
                  .filterBounds(training_region) // use bbox for preliminary tests, sweden_shp for whole sweden
                  .select('B3')  // same result for selecting 1 band and multiple bands
  ;
  print(i + '.size()','S1IW_coll:', S1IW_coll.size(), 'S2_coll:', S2_coll.size());
}
/*
*/
var S1IW_collection = ee.ImageCollection('COPERNICUS/S1_GRD')
                       .filter(ee.Filter.eq('instrumentMode', 'IW'))
                       .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                       .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')) // which should I use??
                       .filter(ee.Filter.date(START_DATE, END_DATE))
                       .filterBounds(SWEDEN_BBOX)
                       .select('VV') // same result for selecting 1 band and multiple bands
;
Map.addLayer(S1IW_collection.geometry(), {}, 'S1IW_collection.geometry()', 0);
print('S1IW_collection.first()', S1IW_collection.first());

var S1EW_collection = ee.ImageCollection('COPERNICUS/S1_GRD')
                       .filter(ee.Filter.eq('instrumentMode', 'EW'))
                       .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'HH'))
                       .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')) // which should I use??
                       .filter(ee.Filter.date(START_DATE, END_DATE))
                       .filterBounds(SWEDEN_BBOX)
                       .select('HH') // same result for selecting 1 band and multiple bands
;
Map.addLayer(S1EW_collection.geometry(), {}, 'S1EW_collection.geometry()', 0);
print('S1EW_collection.first()',S1EW_collection.first());

var S2_collection = ee.ImageCollection('COPERNICUS/S2_SR')
                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20)) // Pre-filter to get less cloudy granules.
                    .filterDate(START_DATE, END_DATE)
                    .filterBounds(SWEDEN_BBOX) // use bbox for preliminary tests, sweden_shp for whole sweden
                    .select('B3')  // same result for selecting 1 band and multiple bands
  ;

print('.size()','S1IW_collection:', S1IW_collection.size(), 'S1EW_collection:', S1EW_collection.size(), 'S2_collection:', S2_collection.size());
// S1IW_collection = 1,439
// S1EW_collection =     0
//   S2_collection = 2,949

var S1IW_count = S1IW_collection.count(); // .clip(SWEDEN_BBOX)
var S1EW_count = S1EW_collection.count(); // .clip(SWEDEN_BBOX)
var  S2_count  =   S2_collection.count(); // .clip(SWEDEN_BBOX)

Export.image.toDrive({
  image: S1IW_count,
  description: 'S1IW_count',
  region: SWEDEN_BBOX,
  maxPixels: 3784216672400,
  scale: 100
});

Export.image.toDrive({
  image: S1EW_count,
  description: 'S1EW_count',
  region: SWEDEN_BBOX,
  maxPixels: 3784216672400,
  scale: 100
});

Export.image.toDrive({
  image: S2_count,
  description: 'S2_count',
  region: SWEDEN_BBOX,
  maxPixels: 3784216672400,
  scale: 100
});

/* MODIS LC preparation and export */

var dataset = ee.ImageCollection('MODIS/006/MCD12Q1');
var igbpLC = dataset.select('LC_Type1').mosaic(); // Annual International Geosphere-Biosphere Programme (IGBP) classification
var MODIS_LC1 = ee.Image(1).where(igbpLC.eq(11), 2).where(igbpLC.eq(17), 3);

var wetland_vis = {min: 1, max: 3, palette: ['000000', 'CDB354','50b9e2'], opacity:0.5};
Map.addLayer(MODIS_LC1, wetland_vis, 'IGBP Land Cover type 1', 0);

Export.image.toDrive({
  image: MODIS_LC1,
  description: 'MODIS_LC1',
  region: SWEDEN_BBOX,
  maxPixels: 3784216672400,
  scale: 500
});

/* --- this visualizations take very long to show, better export! --- */
/*
// Nice vizualisations of the # of available rasters in sweden
var count_vis = {min:0, max:300, palette:['192154','32B449','FDEE1B','C77018','C9231B']};

Map.addLayer(S1IW_count, count_vis, 'S1IW_count', 1);
Map.addLayer(S1EW_count, count_vis, 'S1EW_count', 1);
Map.addLayer(S2_count, count_vis, 'S2_count', 1);

// getthumburl
var count_thumb = {
  'min': 0,
  'max': 300,
  'palette': ['192154','32B449','FDEE1B','C77018','C9231B'],
  'crs': ee.Projection('EPSG:3857'),
  'scale': 100,
  'region': SWEDEN_BBOX
};
print('thumbnail_S1IW_count', thumbnail_S1IW_count.getThumbURL(count_thumb));
print('thumbnail_S1EW_count', thumbnail_S1EW_count.getThumbURL(count_thumb));
print('thumbnail_S2_count', thumbnail_S2_count.getThumbURL(count_thumb));

*/
