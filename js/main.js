// Events
function initializeEvents(traffic) {
  initializeTypeahead(traffic.pairData);
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

function initializeTypeahead(pairData) {

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
      $('#site-status').addClass('status-'+congestionRatioText);
      $('#site-status-text').html(congestionRatioText);

      // Remove segment highlighting on the previous segment (if any) and add to the ne segment
      d3.select('.segment-selected').classed('segment-selected', false);
      d3.select('#svg-pairid-'+pairId).classed('segment-selected', true);

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
  var regionalConditions = getMiseryIndex(traffic)
  $('#average-region-speed').html(regionalConditions.speed);
  $('#misery-index').html(regionalConditions.miseryIndex);

  // Show the congestion ratio
  var congestionRatioText = util.getCongestionRatioText(regionalConditions)
  $('#average-region-status').addClass('status-'+congestionRatioText);
  $('#average-region-status-text').html(congestionRatioText);

}

function prepareGraphSeries(data, color, name) {
  seriesElement = {};
  seriesElement.data = data;
  seriesElement.color = color;
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
    alpha = (1-Math.abs(percentileLevel-50)/50)*0.4;  // Set Color
    var seriesElement = prepareGraphSeries(percentile, 'rgba(70,130,180,'+alpha+')', percentileLevel+"th Percentile")
    seriesData.push(seriesElement);
  }

  // Add the Data for Today
  today = fixFormatting(today, distance)
  var seriesElement = prepareGraphSeries(today, 'rgba(70,130,180,0.7)', 'Today')
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
  var seriesElement = prepareGraphSeries(formattedPredictions, 'rgba(241,82,86,0.7)', 'Predictions')
  seriesData.push(seriesElement);

  // Erase the previous graph (if any) and render the new graph
  $("#historicalTravelTimes").empty();
  var graph = new Rickshaw.Graph({
    element: document.querySelector("#historicalTravelTimes"),
    renderer: 'line',
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
      }
      speedSummation += parseFloat(speed);
      freeflowSummation += parseFloat(freeFlow);
      count++
    }
  }
  miseryIndex = numerator/denominator;
  return {'miseryIndex': miseryIndex.toString().substr(0,3), 'speed': Math.round(speedSummation/count), 'freeFlow': Math.round(freeflowSummation/count)}
}

function renderRoads(traffic, roads, backgroundRoads, idMap) {
  mapElement = $("#map-canvas");

  var width = mapElement.width(),
    height = mapElement.height();

  svg = d3.select("#map-canvas").append("svg")
    .attr("width", width)
    .attr("height", height);

  var projection = d3.geo.mercator()
    .rotate([0, 0])
    .center([-70.95, 42.00])
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
      return 'svg-pairid-'+idMap[d.properties.UID];
    })
    .attr('data-title', function(d, i) {
      try {
        return traffic.pairData[idMap[d.properties.UID]].title
      } catch (e) {
        return ''
      }

    })
    .attr('class','segment')
    .on('click',function(d, i) {
      pathSelect(idMap[d.properties.UID], traffic.pairData);
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

function calculateOffsetVectors(segment, multiplier) {
  var totalLength = segment.getTotalLength();
  var initialPoint = segment.getPointAtLength(0);
  var terminalPoint = segment.getPointAtLength(totalLength);
  var dx, dy;
  dx = terminalPoint.x - initialPoint.x;
  dy = terminalPoint.y - initialPoint.y;

  var length = Math.sqrt(Math.pow(dx,2)+Math.pow(dy,2));

  dx = dx/length;
  dy = dy/length;

  var normalSlope = dx/(-1*dy);
  var offsetVector = {}
  multiplier = (1+multiplier)*2
  offsetVector.x = dy*multiplier;
  offsetVector.y = -1*dx*multiplier;
  var offsetVectorNegative = {}
  offsetVectorNegative.x = -1*dy*multiplier;
  offsetVectorNegative.y = dx*multiplier;
  return [offsetVector, offsetVectorNegative];
}

function spotlightSegments(activeSegment, roadFeature) {
  var activeSegmentMidpoint = activeSegment.getPointAtLength(activeSegment.getTotalLength()/2);
  var spotlightRadius = 10;

  // Remove Existing Labels
  d3.selectAll('.segment-label').remove();

  // Calculate Centroid
  var segments = d3.selectAll('.segment')[0];
  var centroids = [];
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
      var centroid = {}
      centroid.x = 1/3*(initialPoint.x+midPoint.x+terminalPoint.x);
      centroid.y = 1/3*(initialPoint.y+midPoint.y+terminalPoint.y);
      centroid.length = totalLength;
      centroids.push(centroid);
      cNumeratorX += centroid.x*totalLength;
      cNumeratorY += centroid.y*totalLength;
      cDenominator += totalLength
    }
  }
  var com = {'x': cNumeratorX/cDenominator, 'y': cNumeratorY/cDenominator};

  // Remove Flyout Formatting for Older Flyouts
  d3.selectAll('.segment-flyout').attr('class', function(d, i) {
    var classList = this.classList
    updatedClasses = ""
    for (var i=0; i<classList.length; i++) {
      var className = classList[i];
      if (className !== 'segment-flyout') {
        updatedClasses += className;
      }
    }
    return updatedClasses;
  });

  // Calculate Midpoints for All Segments and Compare to Active Segment
  var dataset = [];
  d3.selectAll('.segment').transition().attr('transform', function(d, i) {
    currentSegmentMidpoint = this.getPointAtLength(this.getTotalLength()/2);
    var epicenterDistance = calculateDistance(com, currentSegmentMidpoint);

    // Apply a Transform Attribute
    if (epicenterDistance < spotlightRadius) {
      var offsetVectors = calculateOffsetVectors(this, epicenterDistance);
      var decisionVector = {};

      // Test for the Proper Offset Direction
      for (var i=0; i<offsetVectors.length; i++) {
        offsetVector = offsetVectors[i];
        testSegmentMidpoint = currentSegmentMidpoint;
        testSegmentMidpoint.x += offsetVector.x;
        testSegmentMidpoint.y += offsetVector.y;
        offsetVector.distance = calculateDistance(com,testSegmentMidpoint);
        if (!("distance" in decisionVector) || (offsetVector.distance < decisionVector.distance)) {
          decisionVector = offsetVector;
        }
      }

      // Push Title Data for Text Labels
      currentSegmentEnd = this.getPointAtLength(this.getTotalLength());
      var title = d3.select(this).attr('data-title')
      dataset.push({'name':title, 'x': currentSegmentEnd.x+decisionVector.x, 'y': currentSegmentEnd.y+decisionVector.y })

      // Set Flyout Formatting
      var classes = d3.select(this).attr('class')
      d3.select(this).attr('class', classes + ' segment-flyout');

      // Return the Translation
      return 'translate('+decisionVector.x+','+decisionVector.y+')';

    } else {
      return '';
    }
  });

  // Add Titles to Transformed Elements
  var texts = roadFeature.selectAll("text").data(dataset).enter();
  texts.append("text")
  .text(function(d, i) {
    return d.name;
  })
  .attr('class', 'segment-label')
  .attr('x', function(d, i) {
    return d.x;
  })
  .attr('y', function(d, i) {
    return d.y;
  })

}

// Get Data and Initialize
$.when(
  $.getJSON("current.json"),
  $.getJSON("idMap.json"),
  $.getJSON("roads.json"),
  $.getJSON("topo/background_roads.json")
).then( function (trafficResults, idMapResults, roadsResults, backgroundRoads) {
  traffic = trafficResults[0]
  initializeEvents(traffic);
  renderMiseryIndex(traffic);
  renderRoads(traffic, roadsResults[0], backgroundRoads[0], idMapResults[0]);
  $('#detail-region').removeClass('detail-hidden');
});
