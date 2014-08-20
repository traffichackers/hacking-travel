// Events
function initializeEvents(traffic) {
  initializeTypeahead(traffic);
  //initializePercentileTabsEvents();
}

function initializePercentileTabsEvents() {
  var i = 0;
  var tabs = $('.percentile-graphs').children();
  for (i = 0; i < tabs.length; i++) {
    $(tabs[i]).on("click", function() {
      selectedTab = $(this);
      if (!selectedTab.hasClass('active')) {
        selectedTab.addClass('active');
      }
    });
  }
}

function initializeTypeahead(traffic) {
  var pairData = traffic.pairData;

  // Generate the typeahead dataset
  typeaheadData = []
  for (pairId in pairData) {
    typeaheadData.push( {'pairName': pairData[pairId].title, 'pairId': pairId } );
  }

  // Initialize the bloodhound suggestion engine
  var pairDataEngine = new Bloodhound({
    datumTokenizer: function(d) { return Bloodhound.tokenizers.whitespace(d.pairName); },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    local: typeaheadData
  });
  pairDataEngine.initialize();

  // Instantiate the typeahead UI
  $('#segment-autocomplete').typeahead(null, {
    displayKey: 'pairName',
    source: pairDataEngine.ttAdapter()
  });
  $('#segment-autocomplete').bind('typeahead:selected', function (event, suggestion, dataSet) {
    pathSelect(suggestion.pairId, traffic.pairData);
  });
}


// Handle when the path is clicked or when an item is pulled from the drop-down
var pathSelect = function(pairId, pairData) {
  pairDatum = pairData[pairId];
  if(pairDatum) {

    // Pull the historical percentiles for the pair id
    renderers.setPercentileTabDowLabel();
    $.ajax({
      url: 'data/'+pairId+".json",
    }).done(function(percentiles) {

      $('#segment-title').html(pairDatum.title)

      // Show speed, and travel time
      $('#speed').html(Math.round(pairDatum.speed));
      $('#travelTime').html(Math.round(pairDatum.travelTime/60));

      // Show the congestion ratio
      var congestionRatioText = util.getCongestionRatioText(pairDatum)
      $('#site-status').removeClass (function (index, css) {
        return (css.match (/(^|\s)status-\S+/g) || []).join(' ');
      });
      $('#site-status').addClass('status-'+congestionRatioText);
      $('#site-status-text').html(congestionRatioText);

      // Remove segment highlighting on the previous segment (if any) and add to the ne segment
      d3.select('.segment-selected').classed({'segment':true, 'segment-selected':false});
      d3.select('#svg-pairid-'+pairId).classed({'segment':true, 'segment-selected':true});

      // Draw the graph
      renderGraph(pairDatum, percentiles);

      // Hide the region section and show the segment section
      $('#detail-region').addClass('detail-hidden');
      $('#charts').removeClass('detail-hidden');

    });
  };
};


// Renderers
var renderers = {
  setPercentileTabDowLabel: function() {
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    dow = getDayOfWeek();
    day = 'Previous '+days[dow]+'s';
    $('#dow').children().first().html(day);
  }
}

function renderMiseryIndex(traffic) {

  // Show speed and misery index
  var regionalConditions = getMiseryIndex(traffic);
  $('#average-region-speed').html(regionalConditions.speed);
  $('#misery-index').html(regionalConditions.miseryIndex);

  // Show the congestion ratio
  var congestionRatioText = util.getCongestionRatioText(regionalConditions)
  $('#average-region-status').addClass('status-'+congestionRatioText);
  $('#average-region-status-text').html(congestionRatioText);

  // Show the most heavily impacted segments, if any
  /*
  var impactedSegmentList = '';
  for (var i=0; i<regionalConditions.impactedSegments.length; i++) {
    var segment = regionalConditions.impactedSegments[i];
    if (typeof segment.title !== 'undefined' && typeof segment.speedBelowFreeflow !== 'undefined') {
      impactedSegmentList += '<p>'+segment.title + ', ' + Math.round(segment.speedBelowFreeflow) + ' mph</p>';
   }
   $('#impacted-segments').html(impactedSegmentList)
  }
  */
}

function prepareGraphSeries(data, level) {
  var name = level+"th Percentile"
  var seriesElement = {};
  seriesElement.data = data;
  if (level === 10 || level === 90) {
    seriesElement.color = 'rgb(240,240,240)';
  } else if (level === 30 || level === 70) {
    seriesElement.color = 'rgb(220,220,220)';
  } else if (level === 50) {
    seriesElement.color = 'rgb(200,200,200)';
  } else if (level === 'Today') {
    seriesElement.color = 'rgb(120,120,120)';
  } else if (level === 'Predictions') {
    seriesElement.color = 'rgb(243,154,29)';
  }

  seriesElement.name = name;
  return seriesElement;
}

function renderGraph(pairDatum, percentiles) {

  var today = pairDatum.today
  var predictions = pairDatum.predictions
  var distance = pairDatum.travelTime/60*pairDatum.speed;

  var seriesData = [];

  // Select the proper percentile
  var activeTab = getActivePercentileTab();
  if (activeTab === 'dow') {
    dow = getDayOfWeek();
    chosenPercentiles = percentiles.percentiles[activeTab][dow];
  } else {
    chosenPercentiles = percentiles.percentiles[activeTab];
  }

  // Prepare each percentile
  for (key in chosenPercentiles) {
    percentile = chosenPercentiles[key];
    percentile = fixFormatting(percentile, distance)  // Fix number formatting
    percentileLevel = parseInt(key.slice(1));
    var seriesElement = prepareGraphSeries(percentile, percentileLevel);
    seriesElement.renderer = 'area';
    seriesData.push(seriesElement);
  }


  // Add the Data for Today
  today = fixFormatting(today, distance)
  var seriesElement = prepareGraphSeries(today, 'Today')
  seriesElement.renderer = 'line';
  seriesData.push(seriesElement);

  // Add the Predictions
  var seriesElement = {};
  var formattedPredictions = [];
  var formattedPrediction;
  var currentTime = new Date('1/1/1970');
  currentTime = new Date(currentTime.getTime() - 5*60*60000);
  for (var i=0; i<predictions.length; i++) {
    formattedPrediction = {'x':currentTime.toJSON().substr(11,5),'y':predictions[i]};
    formattedPredictions.push(formattedPrediction);
    currentTime = new Date(currentTime.getTime() + 5*60000);
  }
  formattedPredictions = fixFormatting(formattedPredictions, distance);
  var seriesElement = prepareGraphSeries(formattedPredictions, 'Predictions');
  seriesElement.renderer = 'line';
  seriesData.push(seriesElement);

  // Erase the previous graph (if any) and render the new graph
  $("#historicalTravelTimes").empty();
  var graph = new Rickshaw.Graph({
    element: document.querySelector("#historicalTravelTimes"),
    renderer: 'multi',
    unstack: true,
    series: seriesData,
    width: 400,
    height: 200
  });
  graph.render();

  // Activate the hover effect and show the axes
  var hoverDetail = new Rickshaw.Graph.HoverDetail( { graph: graph });
  var xAxis = new Rickshaw.Graph.Axis.Time({ graph: graph });
  xAxis.render();
  var yAxis = new Rickshaw.Graph.Axis.Y({ graph: graph });
  yAxis.render();

}


// Formatting
function fixFormatting(percentile, distance) {
  for (var i=0; i<percentile.length; i++) {
    if (isNaN(percentile[i].x)) {
      hoursAndMinutes = percentile[i].x.split(':');
      today = new Date();
      newDate = new Date(Date.UTC(1900+today.getYear(), today.getMonth(), today.getDay(), hoursAndMinutes[0], hoursAndMinutes[1]));
      newDate.setHours(newDate.getHours() - 4);
      percentile[i].x = newDate.getTime()/1000;
      percentile[i].y = distance/(percentile[i].y/60);
    }
  }
  return percentile;
}

// Utilities
var util = {

  // Get a text description of the current congestion
  getCongestionRatioText: function(pairDatum) {
    var congestionRatio = pairDatum.speed/pairDatum.freeFlow;
    if (congestionRatio > 0.9) {
      return 'normal';
    } else if (congestionRatio > 0.4) {
      return 'impacted';
    } else {
      return 'congested';
    }
  }
}

function getActivePercentileTab() {
  return $('.percentile-graphs').children('.active').attr('id');
}

function getDayOfWeek() {
  now = new Date();
  return now.getDay();
}

function getMiseryIndex(traffic) {
  var denominator = 0;
  var numerator = 0;
  var speedSummation = 0;
  var freeflowSummation = 0;
  var count = 0;
  var impactedSegments = [];

  for (var pairId in traffic.pairData) {
    pair = traffic.pairData[pairId];

    var speed = pair.speed;
    var freeFlow = pair.freeFlow;
    var travelTime = pair.travelTime;
    var distance, speedBelowFreeflow;
    if (!isNaN(speed) && !isNaN(travelTime) && !isNaN(freeFlow)) {
      distance = travelTime/60*speed;
      denominator += distance;
      speedBelowFreeflow = freeFlow-speed;
      if (speedBelowFreeflow > 0) {
        numerator += speedBelowFreeflow*distance;
        impactedSegments.push({'title':pair.title, 'speedBelowFreeflow':speedBelowFreeflow});
      }
      speedSummation += parseFloat(speed);
      freeflowSummation += parseFloat(freeFlow);
      count++
    }
  }
  miseryIndex = numerator/denominator;

  // Sort the impacted segments
  impactedSegments = _.sortBy(impactedSegments, function(segment){ return -1*segment.speedBelowFreeflow });
  impactedSegments = impactedSegments.slice(0,10);

  return {
    'miseryIndex': miseryIndex.toString().substr(0,3),
    'speed': Math.round(speedSummation/count),
    'freeFlow': Math.round(freeflowSummation/count),
    'impactedSegments': impactedSegments
  }
}

function renderRoads(traffic, roads, backgroundRoads) {
  mapElement = $("#map-canvas");

  var width = mapElement.width(),
    height = mapElement.height();

  svg = d3.select("#map-canvas").append("svg")
    .attr("width", width)
    .attr("height", height);

  var projection = d3.geo.mercator()
    .rotate([0, 0])
    .center([-70.95, 42.05])
    .scale(20000)
    .translate([width / 2, height / 2]);


  var zoom = d3.behavior.zoom()
    .translate([0, 0])
    .scale(1)
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

  var roadFeature = svg.append("g");

  roadFeature.append("path")
    .datum(topojson.feature(backgroundRoads, backgroundRoads.objects.roads))
    .attr("d", d3.geo.path().projection(projection))
    .attr('class','road')

  var roadFeatures = roadFeature.selectAll("path")
    .data(roads.features)
    .enter().append("path")
    .attr("d", d3.geo.path().projection(projection))
    .attr('id', function(d, i) {
      return 'svg-pairid-'+d.properties.SegmentID;
    })
    .attr('data-title', function(d, i) {
      try {
        return traffic.pairData[d.properties.SegmentID].title
      } catch (e) {
        return ''
      }

    })
    .attr('class','segment')
    .on('click',function(d, i) {
      pathSelect(d.properties.SegmentID, traffic.pairData);
    })
    .on('mouseover', function(d, i) {
      spotlightSegments(this, roadFeature);
    })
  svg.call(zoom);

  function zoomed() {
    roadFeature.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    var strokeWidth = roadFeature.style("stroke-width");
    roadFeature.style("stroke-width", strokeWidth / zoom.scale());
  }

};

function calculateDistance(point1, point2) {
  return Math.sqrt(Math.pow(point1.x-point2.x,2) + Math.pow(point1.y-point2.y,2));
}

function translateBoundaries(boundaries,translationVector) {
  returnBoundaries = {}
  returnBoundaries.x1 = boundaries.x1+translationVector.x;
  returnBoundaries.x2 = boundaries.x2+translationVector.x;
  returnBoundaries.y1 = boundaries.y1+translationVector.y;
  returnBoundaries.y2 = boundaries.y2+translationVector.y;
  return returnBoundaries;
}

function getBoundaries(path) {
  var boundingBox = path.getBBox();
  return {
    'x1': boundingBox.x,
    'y1': boundingBox.y,
    'x2': boundingBox.x+boundingBox.width,
    'y2': boundingBox.y+boundingBox.height
  };
}

function hasOverlap(a, b) {
  // X Overlap
  var xOverlap = false;
  if (a.x1 < b.x1 && a.x2 > b.x1) {
    xOverlap = true;
  } else if (a.x1 < b.x2 && a.x2 > b.x2) {
    xOverlap = true;
  } else if (b.x1 < a.x1 && b.x2 > a.x1) {
    xOverlap = true;
  } else if (b.x1 < a.x2 && b.x2 > a.x2) {
    xOverlap = true;
  }

  // Y Overlap
  var yOverlap = false;
  if (a.y1 < b.y1 && a.y2 > b.y1) {
    yOverlap = true;
  } else if (a.y1 < b.y2 && a.y2 > b.y2) {
    yOverlap = true;
  } else if (b.y1 < a.y1 && b.y2 > a.y1) {
    yOverlap = true;
  } else if (b.y1 < a.y2 && b.y2 > a.y2) {
    yOverlap = true;
  }

  if (xOverlap && yOverlap) {
    return true;
  } else {
    return false;
  }

}

function addMargin(box, margin) {
  box.x1 = box.x1-margin;
  box.x2 = box.x2+margin;
  box.y1 = box.y1-margin;
  box.y2 = box.y2+margin;
  return box;
}

function getNormalVectors(segment) {

  // Get dx and dy for the current segment
  var totalLength = segment.getTotalLength();
  var initialPoint = segment.getPointAtLength(0);
  var terminalPoint = segment.getPointAtLength(totalLength);
  var dx = terminalPoint.x - initialPoint.x;
  var dy = terminalPoint.y - initialPoint.y;

  // Normalize
  var length = Math.sqrt(Math.pow(dx,2)+Math.pow(dy,2));
  dx = dx/length;
  dy = dy/length;

  return [{'x':dy, 'y':-1*dx}, {'x': -1*dy, 'y':dx}]
}

function getCentroid(activeSegment, roadFeature, spotlightRadius) {

  // Calculate Centroid
  var activeSegmentMidpoint = activeSegment.getPointAtLength(activeSegment.getTotalLength()/2);
  var segments = roadFeature.selectAll('.segment')[0];
  var cNumeratorX = 0;
  var cNumeratorY = 0;
  var cDenominator = 0;
  for (var i=0; i<segments.length; i++) {
    var segment = segments[i];

    var totalLength = segment.getTotalLength();
    var midPoint = segment.getPointAtLength(totalLength/2);
    var epicenterDistance = calculateDistance(activeSegmentMidpoint,midPoint);
    if (epicenterDistance < spotlightRadius) {
      var initialPoint = segment.getPointAtLength(0);
      var terminalPoint = segment.getPointAtLength(totalLength);
      var xCentroid = 1/3*(initialPoint.x+midPoint.x+terminalPoint.x);
      var yCentroid = 1/3*(initialPoint.y+midPoint.y+terminalPoint.y);

      cNumeratorX += xCentroid*totalLength;
      cNumeratorY += yCentroid*totalLength;
      cDenominator += totalLength;
    }
  }
  return {'x': cNumeratorX/cDenominator, 'y': cNumeratorY/cDenominator};
}

function getCloserIndex(csm, com, offsetVectors) {
  var closerIndex;
  var distance, candidateDistance
  for (var i=0; i<offsetVectors.length; i++) {
    offsetVector = offsetVectors[i];
    if (typeof offsetVector !== 'undefined') {
      translatedCsm = {'x': csm.x+offsetVector.x, 'y': csm.y+offsetVector.y }
      candidateDistance = calculateDistance(com,translatedCsm);
      if (typeof distance == 'undefined' || candidateDistance <= distance) {
        closerIndex = i;
      }
    }
  }
  return closerIndex;
}

function applyNormalVectorMultiplier(normalVector, multiplier) {
  offsetVector = {};
  offsetVector.x = normalVector.x*multiplier;
  offsetVector.y = normalVector.y*multiplier;
  return offsetVector
}

function getOffsetVector(currentSegment, queuedTransformations, currentSegmentMidpoint, com, currentBoundaries) {
  var baseMultiplier = 5;
  var multiplier = baseMultiplier;

  // Calculate the normal vectors
  var normalVectors = getNormalVectors(currentSegment);

  // Calcuate the base offset
  var offsetVectors = [];
  var closerIndex = getCloserIndex(currentSegmentMidpoint, com, normalVectors);
  offsetVectors[closerIndex] = applyNormalVectorMultiplier(normalVectors[closerIndex], multiplier)

  // Check if the base offset has any collisions
  var translatedBoundaries = translateBoundaries(currentBoundaries,offsetVectors[closerIndex]);
  for (var j=0; j<queuedTransformations.length; j++) {
    var previousBoundaries = queuedTransformations[j].boundaries;
    if (hasOverlap(translatedBoundaries, previousBoundaries)) {
      offsetVectors[closerIndex] = applyNormalVectorMultiplier(normalVectors[closerIndex], multiplier)
      closerIndex = getCloserIndex(currentSegmentMidpoint, com, offsetVectors);
      translatedBoundaries = translateBoundaries(currentBoundaries,offsetVectors[closerIndex]);
      j = 0;
      multiplier += baseMultiplier;
    }
  }
  return offsetVectors[closerIndex];
}

function addSegmentLabel(roadFeature, transformation) {
  var transformations = []
  transformations.push(transformation);

  // Remove labels from paths in prior generations
  d3.selectAll('.segment-label').remove();

  // Add labels to newly translated paths
  var texts = roadFeature.selectAll("text").data(transformations).enter();
  texts.append("text")
  .text(function(d, i) {
    return d.name;
  })
  .attr('class', 'segment-label')
  .attr('x', function(d, i) {
    return d.boundaries.x1 - 10;
  })
  .attr('y', function(d, i) {
    return d.boundaries.y1 - 10;
  })

}

function spotlightSegments(activeSegment, roadFeature) {
  if (!activeSegment.classList.contains('segment-flyout')) {

    var spotlightRadius = 5;
    var priorTransformations = [];

    // Remove previous generation segment flyouts, if any
    d3.selectAll('.segment-flyout').classed('segment-flyout',false)

    // Calculate the center of mass for all segments within the spotlightRadius
    var com = getCentroid(activeSegment, roadFeature, spotlightRadius)

    // See the transform attribute on the road segments
    var activeBoundaries = getBoundaries(activeSegment);
    var activeBoundariesWithMargin = addMargin(activeBoundaries, spotlightRadius);
    d3.selectAll('.segment')
      .transition()
      .duration(750)
      .attr('transform', function(d, i) {
        var currentBoundaries = getBoundaries(this);

        // Determine if current segment is close to the active segment
        currentSegmentMidpoint = this.getPointAtLength(this.getTotalLength()/2);
        var epicenterDistance = calculateDistance(com, currentSegmentMidpoint);

        if (activeSegment.id !== this.id && hasOverlap(activeBoundariesWithMargin, currentBoundaries)) {

          var offsetVector = getOffsetVector(this, priorTransformations, currentSegmentMidpoint, com, currentBoundaries);

          // Store a record of this transformation
          var currentSegmentEnd = this.getPointAtLength(this.getTotalLength());
          var priorTransformation = {
            'name': d3.select(this).attr('data-title'),
            'boundaries': translateBoundaries(currentBoundaries,offsetVector)

          }
          priorTransformations.push(priorTransformation);

          // Set Flyout Formatting
          d3.select(this).classed('segment-flyout',true);

          // Render label on mouseover
          d3.select(this).on('mouseover', function(d, i) {
            addSegmentLabel(roadFeature,priorTransformation);
          })



          // Return the Translation
          return 'translate('+offsetVector.x+','+offsetVector.y+')';

        // Return a zero translation if the current segment is not close to the active segment
        } else {
          return 'translate(0,0)';
        }
      }
    );

  }

}

// Get Data and Initialize
$.when(
  $.getJSON("current.json"),
  $.getJSON("roads.json"),
  $.getJSON("topo/background_roads.json")
).then( function (trafficResults, roadsResults, backgroundRoads) {
  var traffic = trafficResults[0];
  initializeEvents(traffic);
  renderMiseryIndex(traffic);
  renderRoads(traffic, roadsResults[0], backgroundRoads[0]);
  $('#detail-region').removeClass('detail-hidden');
});
