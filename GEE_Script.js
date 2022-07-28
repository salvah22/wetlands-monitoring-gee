/* Author: Salvador Antonio Hernández Malavé. Developed for Mapping Swedish wetlands manuscript.
 * Last edited: July 28th, 2022. Created: Feb 06th, 2022.
 *
 * Copyright (c) 2022, Salvador Antonio Hernández Malavé.
 * All rights reserved.
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree (https://github.com/salvah22/wetlands-monitoring-gee)
 *
 * The script takes less than 5 minutes (most counties) to run from top to bottom, preparing the input,
 * computing the stratified sample algorithm, training, classifying the sample, and printing relevant
 * statistics such as the confusion matrix, accuracies and feature importance.
 * Nonetheless, tasks sent to the tasks panel need to be run manually, and saving to the drive will take 2h at
 * most (norrbottens).
 *
 * The following datasets need to be uploaded as assets:
 *  1. target_labels (if byte type, remember setting no-data value to 0 when uploading),rasterized polygons to be
 *     used during the training || Classes: [0: 'no-data', 1: 'non-wetlands', 2: 'wetlands', 3: 'water']
 *  2. validation_labels: same as target_labels but for the validation step
 *     NOTE: target_labels must have at least 5 sqkm for each class for each county, to fit 5000 points, while
 *     validation_labels must have at least 15 sqkm for each class for each county, to fit 15000 points.
 *  3. topographic data (dem, slope, tpi, twi), GSD 50+ was used. GEE did not have any high/medium res DEM by the date
 *  4. sweden_Shp (Översiktskartan) prepared counties shp, this one is not even closely important as 1 & 2.
 *
 * NOTE: indicating VERBOSE == true does not imply that the computation will succeed to be printed in the console,
 * since console operations time out after 5 minutes, exporting tasks will succeed after a couple of hours at most.
 * Norrbottens is not computed in a short enough time for working with VERBOSE == true
 */

/* ------------------------------------------------------------------------------------------------
   ------------------------------------------- User Input -----------------------------------------
   ------------------------------------------------------------------------------------------------ */

var TRAINING_REGION_STR = 'Norrbotten'; // must be one of the counties_lanskod (variable) dictionary keys (look below), or 'all'
var STRATIFIED_SAMPLE_GEOMETRIES = false; // if geometries are required to be preserved and exported set to true, use with care, it allocates more memory, increasing the risk of reaching memory limits
var N_POINTS_TRAINING = 5000;
var N_POINTS_VALIDATION = 10000;
var VERBOSE = false; // true if printing information in the console for debugging is desired (true/false)
var YEAR_STR = ['2021'];
var  SEASONS = ['summer']; // can also include: 'spring','winter','fall'
var    BANDS = [['VV','VH'], [], ['B2','B3','B4','B8'], ['NDVI','NDWI'], ['tpi','twi','slope']];
/* BANDS is a list of lists in this order: [S1IW_bands, S1EW_bands, S2_bands, Indices, topographic_data]
 * we are not using: 'HH','HV','B5','B6','B7' */

/* ------------------------------------------------------------------------------------------------
   ----------------------------------------- Setup / init -----------------------------------------
   ------------------------------------------------------------------------------------------------ */

// runtime
var today = new Date();
print('Script start time (GMT+00:00):', today);
var rt1 = new Date(2022,2,8); // Date(2022,2,8) = March 8th, 2022 // rt = referenceTime
var runId = Math.abs(Math.round((rt1.getTime() - today) / 60000)); // minutes from referenceTime (rt1)
var runLabel = TRAINING_REGION_STR + '_run' + runId;
// county information for filtering sweden_shp delimitations, the numbers match LANSKOD attribute k:v pair,
var counties_lanskod = {
'Stockholm': 1,
'Uppsala': 3,
'Sodermanland': 4,
'Ostergotland': 5,
'Jonkoping': 6,
'Kronoberg': 7,
'Kalmar': 8,
'Gotland': 9,
'Blekinge': 10,
'Skane': 12,
'Halland': 13,
'VastraGotaland': 14,
'Varmland': 17,
'Orebro': 18,
'Vastmanland': 19,
'Dalarna': 20,
'Gavleborg': 21,
'Vasternorrland': 22,
'Jamtland': 23,
'Vasterbotten': 24,
'Norrbotten': 25
// no counties with LANSKOD numbers 2, 11, 15, 16 & 17 provided by lantmäteriet.
};
// sweden_shp has some intricate geometries that should ONLY be used for displaying and exporting...
// counties_bbox is an effort to circumvent some complicated geometries of sweden_shp (EPSG:4326)
var counties_bbox = {
'Stockholm':       ee.Geometry.Rectangle([17.2147, 58.688, 19.7237, 60.3146]),
'Uppsala':         ee.Geometry.Rectangle([16.6567, 59.3516, 18.9345, 60.6744]),
'Sodermanland':    ee.Geometry.Rectangle([15.6086, 58.4985, 17.7656, 59.5456]),
'Ostergotland':    ee.Geometry.Rectangle([14.4027, 57.6836, 17.1262, 59.0209]),
'Jonkoping':       ee.Geometry.Rectangle([13.0213, 56.8663, 15.6767, 58.1868]),
'Kronoberg':       ee.Geometry.Rectangle([13.2799, 56.3477, 15.8429, 57.236]),
'Kalmar':          ee.Geometry.Rectangle([15.3347, 56.1832, 17.2832, 58.1471]),
'Gotland':         ee.Geometry.Rectangle([17.9273, 56.8751, 19.4033, 58.4298]),
'Blekinge':        ee.Geometry.Rectangle([14.3874, 55.949, 16.0736, 56.5031]),
'Skane':           ee.Geometry.Rectangle([12.432, 55.3225, 14.5941, 56.5356]),
'Halland':         ee.Geometry.Rectangle([11.8119, 56.2984, 13.7158, 57.6192]),
'VastraGotaland':  ee.Geometry.Rectangle([10.9231, 57.1011, 14.7879, 59.2924]),
'Varmland':        ee.Geometry.Rectangle([11.5418, 58.6971, 14.4879, 61.075]),
'Orebro':          ee.Geometry.Rectangle([14.2613, 58.6438, 15.8211, 60.1085]),
'Vastmanland':     ee.Geometry.Rectangle([15.414, 59.1856, 17.0048, 60.206]),
'Dalarna':         ee.Geometry.Rectangle([12.0866, 59.8278, 16.8206, 62.2818]),
'Gavleborg':       ee.Geometry.Rectangle([14.4338, 60.1765, 17.6936, 62.3436]),
'Vasternorrland':  ee.Geometry.Rectangle([14.7693, 62.0984, 19.3636, 64.0379]),
'Jamtland':        ee.Geometry.Rectangle([11.7697, 61.5351, 17.1597, 65.1049]),
'Vasterbotten':    ee.Geometry.Rectangle([14.2933, 63.3353, 22.0705, 66.3443]),
'Norrbotten':      ee.Geometry.Rectangle([15.3589, 64.9372, 25.4839, 69.1492]),
'Sweden':          ee.Geometry.Rectangle([10.9231, 55.0000, 25.4839, 69.1492])
};
// function to simplify some of the shapefiles used to restrict the (training) area and other operations
function simplify_counties_shp() {
  // uppsala, vastra-gotalands, varmlands, Vasternorrlands, jamtlands, vasterbottens & norbottens can exceed memory!
  // source: https://gis.stackexchange.com/a/351706/202618
  if (TRAINING_REGION_STR === 'all') {
    return ee.FeatureCollection(counties_bbox[TRAINING_REGION_STR]);
  } else if (containsObject(TRAINING_REGION_STR, ['Norrbotten','Jamtlands'])) {
    return sweden_shp.filter('LANSKOD == ' + counties_lanskod[TRAINING_REGION_STR]).map(function(f){return f.simplify(30)});
    //return ee.FeatureCollection(counties_bbox[TRAINING_REGION_STR]);
  } else if (containsObject(TRAINING_REGION_STR, ['Vasternorrland','Vasterbotten'])) {
    return sweden_shp.filter('LANSKOD == ' + counties_lanskod[TRAINING_REGION_STR]).map(function(f){return f.simplify(20)});
  } else if (containsObject(TRAINING_REGION_STR, ['Uppsala','VastraGotaland','Varmland'])) {
    return sweden_shp.filter('LANSKOD == ' + counties_lanskod[TRAINING_REGION_STR]).map(function(f){return f.simplify(10)});
  } else {
    return sweden_shp.filter('LANSKOD == ' + counties_lanskod[TRAINING_REGION_STR]);
  }
}

/* -------------------------------------------------------------------------------------------------
   --------------------------------- Importing imagery and shp data --------------------------------
   ------------------------------------------------------------------------------------------------- */

// prepare the shp data into Feature collections for cropping and other operations on the imagery
var sweden_shp = ee.FeatureCollection("users/sa3175he/sweden_shp");
var training_region = simplify_counties_shp();
// loading the raster with training polygons
if (containsObject(TRAINING_REGION_STR, ['Orebro','VastraGotaland','Varmland'])) {
  // lazy solution to not generate & upload another 10gb raster, since I repeated these three counties
  var target_labels = ee.Image('users/sa3175he/target10m_14_17_18').rename('target');
} else {
  var target_labels = ee.Image('users/sa3175he/target10m_lm2_training').rename('target');  // previously wetlands_mask_last3006
}
// loading the raster with the validation polygons, and adding the data to it
var validation_labels = ee.Image('users/sa3175he/target10m_lm2_validation').rename('target2');
// visualizations
var VMI = ee.Image('users/sa3175he/target10m_lm1');
var wetlands_vis = {min: 1, max: 3, palette: ['000000', 'CDB354','50b9e2'], opacity:0.5};
if (VERBOSE===true){print('training_region: ' + TRAINING_REGION_STR, training_region)}
Map.addLayer(training_region, {}, 'training_region_'+TRAINING_REGION_STR, 0);
Map.addLayer(counties_bbox[TRAINING_REGION_STR], {}, TRAINING_REGION_STR+'_bbox', 0);
Map.addLayer(target_labels.visualize(wetlands_vis).clip(training_region), {}, 'target_training_labels', 0); // VMI wetlands mask + Lantmäteriet water shape
Map.addLayer(validation_labels.visualize(wetlands_vis).clip(training_region), {}, 'validation_labels', 0);
Map.addLayer(VMI.clip(training_region).visualize(wetlands_vis),{},'VMI',0);
Map.centerObject(counties_bbox[TRAINING_REGION_STR].centroid({'maxError': 10}), 9);
// Load Sentinel-1 C-band SAR Ground Range collection (log scale, VV+VH, Interferometric Wide Swath EW Acquisition Mode)
// https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD
var S1IW_collection = ee.ImageCollection('COPERNICUS/S1_GRD')
                      .filter(ee.Filter.eq('instrumentMode', 'IW'))
                      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                      .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING')) // which should I use??
                      .filterBounds(counties_bbox[TRAINING_REGION_STR])
                      .select(BANDS[0]) // same result for selecting 1 band and multiple bands
;
if (VERBOSE===true){var S1_proj = S1IW_collection.select('VV').first().projection();print('S1IW_collection.first().projection()', S1_proj);}
// Load Sentinel-2 MultiSpectral Instrument MSI (Level 2A)
// https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR#image-properties
var S2_collection = ee.ImageCollection('COPERNICUS/S2_SR')
  .select(BANDS[2].concat(['B1','QA60','MSK_CLDPRB'])) // the concatenated bands are for masking clouds
  .filterBounds(counties_bbox[TRAINING_REGION_STR])
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20)) // filter to get less cloudy granules.
;
// Topographic Data, works by referencing assets with the names users/sa3175he/tpi, users/sa3175he/twi, users/sa3175he/slope
for (var i in BANDS[4]){
  var topo_str = BANDS[4][i];
  if (i == 0){
    var topo_data = ee.Image('users/sa3175he/' + topo_str).rename(topo_str);
  } else {
    topo_data = topo_data.addBands(ee.Image('users/sa3175he/' + topo_str).rename(topo_str));
  }
  if (topo_str == 'dem'){
    Map.addLayer(topo_data, {bands: 'dem', min:0, max:1000}, 'Lantmäteriet National DEM', 0);
  }
  topo_data = topo_data.resample('bilinear');
}
// preparing the imagery, from the desired inputs (check BANDS variable)
// it is important that the target raster is the first band of the input images
var prepared_img = AlgorithmPrepare();
var input = target_labels.addBands(prepared_img).addBands(topo_data);
var input_val = validation_labels.addBands(prepared_img).addBands(topo_data); // val == validation
var training_bands = input.bandNames().splice(0,1); // all but the first!
if (VERBOSE===true){print('input', input, 'input.geometry()', input.geometry());}
// Classifier parameters
var my_params = {numberOfTrees: 80};
var amani_params = {numberOfTrees: 80, minLeafPopulation: 2, bagFraction: 0.5}; // https://www.mdpi.com/2072-4292/11/7/842
var mahdianpari_params = {numberOfTrees: 500};
// declaration of the classifier
var classifier = ee.Classifier.smileRandomForest(my_params);
// run the machine learning algorithm!
AlgorithmML();

/* -----------------------------------------------------------------------------------------------
   ------------------------------------------ Functions ------------------------------------------
   ----------------------------------------------------------------------------------------------- */

// function to chck if a list contains an object
function containsObject(obj, list) {
  for (var i = 0; i < list.length; i++) {
    if (list[i] === obj) {
        return true;

    }
  }
  return false;
}

// Function to mask clouds using Sentinel-2 QA60 band
function maskS2clouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11; // Bits 10 and 11 are clouds and cirrus, respectively.
  var mask =  qa.bitwiseAnd(cloudBitMask).eq(0)
                .and(qa.bitwiseAnd(cirrusBitMask).eq(0)) // Both bits should be zero, indicating clear conditions.
                .and(image.select('MSK_CLDPRB').lte(5)) // additionally, MSK_CLDPRB less than 5
                .and(image.select('B1').lte(1800)) // additionally, pixels where B1>1800
  ;
  return image.updateMask(mask);
}

/* prepareImage is a function that returns a multi-band image from Sentinel 1 & 2 collections, filtering dates
 * from the given p parameters dictionary, also renames bands according to the desired season, if required.*/
function prepareImage(parameters){
  var for_string = parameters.for_string,
      season_start = parameters.season_start,
      season_end = parameters.season_end;

  /* --- S1  --- */
  var for_filter = ee.Filter.date(season_start, season_end);
  var S1IW_image = S1IW_collection.filter(for_filter)
                                  .map(function(image) { // this function will work to remove values less than -30.0
                                          var edge = image.lt(-30.0);
                                          var maskedImage = image.mask().and(edge.not());
                                          return image.updateMask(maskedImage);
                                  })
                                  .mean()
                                  .rename(BANDS[0].map(function(v){return v+for_string}));
  if (containsObject('NDPI', BANDS[3])) {
    S1IW_image = S1IW_image.addBands(S1IW_image.expression('(VV - VH) / (VV + VH)', {'VH': S1IW_image.select('VH'+for_string), 'VV': S1IW_image.select('VV'+for_string) }).rename('NDPI'+for_string));
    Map.addLayer( S1IW_image,
                  {bands: 'NDPI'+for_string, min: -1, max: 1},
                  'S1: NDPI' + for_string ,
                  0);
  }

  /* --- S2 --- */
  var S2_image = S2_collection.filterDate(season_start, season_end) // HAS to be before the .map
                              .map(maskS2clouds)
                              .select(BANDS[2]) // best before the median...
                              .median()
                              .rename(BANDS[2].map(function(v){return v+for_string}));
  if (containsObject('NDVI', BANDS[3])) {
    var ndvi = S2_image.normalizedDifference(['B8'+for_string, 'B4'+for_string]).rename('NDVI'+for_string)
    S2_image = S2_image.addBands(ndvi)
  }
  if (containsObject('NDWI', BANDS[3])) {
    var ndwi = S2_image.normalizedDifference(['B3'+for_string, 'B8'+for_string]).rename('NDWI'+for_string)
    S2_image = S2_image.addBands(ndwi)
  }

  /* --- joint --- */
  return S2_image.addBands(S1IW_image);
}

/* AlgorithmPrepare() function prepares the input time-wise, looping through the desired seasons & years, where a band
 *for each season in each year will be generated from satellite collections (S1IW_collection & S2_collection). */
function AlgorithmPrepare() {
  var season_str = ['winter', 'spring', 'summer', 'fall'];
  var season_breaks = ['-12-01', '-03-01', '-06-01', '-09-01'];
  var first_occurrence_counter = 0;
  for (var j in YEAR_STR) { // directly depends on the user input
    for (var i in season_str) { // will always iterate 4 times, but only output when required
      var season = season_str[i];
      // but we only proceed if the season is required by the user
      if (containsObject(season, SEASONS)) {
        // preparing for_string, season_start and season_end strings, used to filter satellite collections in prepareImage()
        if (i == 0) { // winter case, first sequence
          var ttt = YEAR_STR[j]-1;
          var for_string = '_' + season + ttt; // example: 2019_winter_ = dec 01 (2019) to mar 01 (2020)
          var season_start = YEAR_STR[j]-1 + season_breaks[i];
          var season_end = YEAR_STR[j] + season_breaks[Number(i)+1];
        } else { // non-winter
          var for_string =  '_' + season + YEAR_STR[j];
          var season_start = YEAR_STR[j] + season_breaks[i];
          if (i == 3) { // special case, assign the first break to fall' end
            var season_end = YEAR_STR[j] + season_breaks[0];
          } else {
            var season_end = YEAR_STR[j] + season_breaks[Number(i)+1];
          }
        }
        // p is stands for parameters, the only argument for prepareImage()
        var p = {'for_string':for_string, 'season_start':season_start, 'season_end':season_end};

        if (first_occurrence_counter == 0) { // first_case handling
          var output = prepareImage(p);
          first_occurrence_counter++;
        } else {
          output = output.addBands(prepareImage(p));
        }
        Map.addLayer( output,
                      {'min':0,'max':3000,bands:['B4'+for_string, 'B3'+for_string, 'B2'+for_string]},
                      'S2: ' + 'RGB' + for_string ,
                      0);
        Map.addLayer( output,
                      {bands: 'VV'+for_string, min: -25, max: 5},
                      'S1: VV' + for_string ,
                      0);
        Map.addLayer( output,
                      {bands: 'VH'+for_string, min: -25, max: 5},
                      'S1: VH' + for_string ,
                      0);
      }
    }
  }
  return output;
}

// Machine Learning algorithm
function AlgorithmML() {
  var separation=10;
  // training subset of points, sampled from the imagery contained within training polygons
  var training = input.stratifiedSample({ numPoints: N_POINTS_TRAINING,
                                          classBand: 'target',
                                          scale: separation,
                                          region: training_region,
                                          geometries: STRATIFIED_SAMPLE_GEOMETRIES});
  // validation subset of points, sampled from the imagery contained within validation polygons
  var validation = input_val.stratifiedSample({ numPoints: N_POINTS_VALIDATION,
                                                classBand: 'target2', //
                                                scale: separation,
                                                region: training_region,
                                                geometries: STRATIFIED_SAMPLE_GEOMETRIES});
  // add to map if possible
  if(STRATIFIED_SAMPLE_GEOMETRIES){
    Map.addLayer(training.draw({color: 'FFCC33', strokeWidth: 0, pointRadius:1}), {}, 'training set', 0);
    Map.addLayer(validation.draw({color: '00FFC8', strokeWidth: 0, pointRadius:1}), {}, 'validation set', 0);
  }
  // computation timed out usually occurrs when the stratified sampling takes >5min
  if (VERBOSE===true){print('training.first()', training.first()); print('validation.first()', validation.first());} // no point on trying to print all the training_set, if it has >5000 observations

  /* ---- Training the classifier ---- */
  // https://developers.google.com/earth-engine/guides/classification
  classifier = classifier.train({ features: training,
                                  classProperty: 'target',
                                  inputProperties: training_bands});
  var dict = classifier.explain();
  var trainAccuracy = classifier.confusionMatrix();

  /* ---- feature importance extraction and export ---- */
  var variable_importance = ee.Feature(null, ee.Dictionary(dict).get('importance'));
  var chart_fi = ui.Chart.feature.byProperty(variable_importance)
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Random Forest Variable Importance',
      legend: {position: 'none'},
      hAxis: {title: 'Bands'},
      vAxis: {title: 'Importance'}
    });
  Export.table.toDrive({
    collection: ee.FeatureCollection(variable_importance),
    description: runLabel + '_featureImportance',
    fileFormat: 'CSV'
  });

  /* ---- Classifying the validation set ---- */
  var val = validation.classify(classifier);
  var acc = val.errorMatrix('target2', 'classification');

  /* ------ Printing results ----- */
  // https://gis.stackexchange.com/questions/274166/exporting-classification-error-matrix-google-earth-engine
  if (VERBOSE === true) {
    var training_summary = {'Training Confusion matrix': trainAccuracy,
                            'Training overall accuracy': trainAccuracy.accuracy(),
                            'Training producers accuracy': trainAccuracy.producersAccuracy(),
                            'Training consumers accuracy': trainAccuracy.consumersAccuracy(),
                            'Training Kappa statistic': trainAccuracy.kappa()
    };
    print('Training step: ' + runLabel, training_summary, chart_fi);
    var validation_summary = {'Validation Error matrix': acc,
                              'Validation overall accuracy': acc.accuracy(),
                              'Validation producers accuracy': acc.producersAccuracy(),
                              'Validation consumers accuracy': acc.consumersAccuracy(),
                              'Validation Kappa statistic': acc.kappa()
    };
    print('Validation step: ', validation_summary);
  } else {
    print(runLabel, 'VERBOSE == false, check Tasks panel');
  }

  /* ---- Exporting confussion/error matrices and classifications ---- */
  var matrices = ee.Feature(null, {'trainConfussionMatrix': trainAccuracy.array(), 'validationErrorMatrix': acc.array()});
  Export.table.toDrive({
    collection: ee.FeatureCollection(matrices),
    description: runLabel + '_accuracyMatrices',
    fileFormat: 'CSV'
  });
  // Classify the input imagery.
  // here clipToCollection(training_region) is "important", so no prediction is done outside of county borders
  var classified = input.clipToCollection(training_region).classify(classifier);
  Map.addLayer(classified.visualize(wetlands_vis), {}, 'classified', 0);
  Export.image.toDrive({
    image: classified, // using .clip wasnt working with the big counties
    crs: 'EPSG:3006',
    description: runLabel + '_classified10',
    region: counties_bbox[TRAINING_REGION_STR],
    maxPixels: 3784216672400,
    scale: 10
  });
  var training_ss_classified = training.classify(classifier);
  Export.table.toDrive({
      collection: training_ss_classified,
      description: runLabel + '_training_ss_classified',
      fileFormat: 'CSV'
  });
  var validation_ss_classified = validation.classify(classifier);
  Export.table.toDrive({
      collection: validation_ss_classified,
      description: runLabel + '_validation_ss_classified',
      fileFormat: 'CSV'
  });
}

/* Some important documentation employed:
 * https://developers.google.com/earth-engine/guides/debugging#user-memory-limit-exceeded
 * https://developers.google.cn/earth-engine/guides/best_practices#if-you-need-to-clip-with-a-complex-collection,-use-cliptocollection
 * https://developers.google.com/earth-engine/guides/reducers_intro
 */

