# Swedish Wetlands classification with GEE

This repository contains 3 scripts, used for monitoring, and mapping wetlands in Sweden, by classifying multi-source data (optical, radar, topographical) with Random Forests machine learning algorithms

The three scripts are:
* 1. GEE-Script-COUNT-MODIS.js
* 2. GEE-Script-RF.js
* 3. Processing_Journal.ipynb

Script 1 (GEE-Script-COUNT-MODIS.js) was used to compute the amount of images from the two datasets hosted in GEE (Sentinel-1 & Sentinel-2), that captured each Swedish county during summer of 2021, and the whole country. Additionally, it loads, process, and exports a MODIS LC product, for comparing to the wetlands inventory produced by the classification.

Script 2 (GEE-Script-RF.js) was developed to be run in the GEE Code Editor (https://code.earthengine.google.com/). There are 4 variables that the user must pay attention to, PARAMETERS_STR, YEAR_STR, SEASONS, and BANDS. The script requires a shapefile that has a LANSKOD (county code) attribute with numbers for each Swedish county, uploaded as a personal asset. Additionally, it loads two datasets hosted in GEE (Sentinel-1 & Sentinel-2), the topographical data (TPI, TWI, slope) computed outside GEE environment, and uploaded as personal assets, and a raster containing the labels. This last raster (labels), was of binary type (but anyelse should work), and contained only three classes, wetlands (2), non-wetlands (1), and water (3), but the script should work even if the number of classes is greater. The labels were uploaded as a rasterized version of polygons, for the ease of the workflow in GEE, using polygons would require a revamp. NOTE: If this code is to be used with more than 3 classes, mind the number of points to be computed per class, in the PARAMETERS string, because a maximum of 150,000 of points were observed to work properly.

Script 3 (Processing_Journal.ipynb) contains all of the pre-processing (mostly topographical data), and post-processing (analisis of results) related code. It doesn't work only with python, but some bash scripts can be found inside (and therefore some libraries outside python are required).

Google Earth Engine (GEE) is a petabyte-scale RS data catalog, and cloud processing environment that helps scientists to access, process, and analyze satellite imagery, with the addition of machine learning algorithms. This work was not possible without the capabilities of GEE.

These are the scripts used, and developed for my master's thesis, for attaining the degree of MSc in Geomatics.
