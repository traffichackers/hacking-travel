var roadSegmentStrokeColor = 'rgb(99,76,124)';
var selectedRoadSegmentStrokeColor = 'rgb(197,253,115)';
var highlightedRoadSegmentStrokeColor = 'rgb(232,186,180)';
var highlightedRouteSegment;
var selectedRouteSegment = null;
var highlightedRouteSegment = null;
var activeTraffic;
var activeDistance;
var activePairId;
var activePercentiles;

// Events
function initializeEvents() {
  initializePercentileTabsEvents();
}

function initializePercentileTabsEvents() {
  var i = 0;
  var tabs = $('.percentile-graphs').children();
  for (i = 0; i < tabs.length; i++) {
    $(tabs[i]).on("click", function() {
      selectedTab = $(this);
      if (!selectedTab.hasClass('active')) {
        selectedTab.addClass('active');
        var tabs = $('.percentile-graphs').children();
        for (i = 0; i < tabs.length; i++) {
          currentTab = $(tabs[i]);
          if (currentTab.hasClass('active') && currentTab.attr('id') !== selectedTab.attr('id')) {
            currentTab.removeClass('active');
          }
        }
        renderGraph(activeTraffic.pairData[activePairId].today, activePredictions, activePercentiles, activeDistance);
      }
    });
  }
}

// Renderers
function setPercentileTabDateLabel() {
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  dow = getDayOfWeek();
  day = 'Previous '+days[dow]+'s';
  $('#dow').children().first().html(day);
}

function renderMiseryIndex(traffic) {
  miseryIndex = getMiseryIndex(traffic);
}

function prepareGraphSeries(data, color, name) {
  seriesElement = {};
  seriesElement.data = data;
  seriesElement.color = color;
  seriesElement.name = name;
  return seriesElement;
}

function renderGraph(today, predictions, percentiles, distance) {
  seriesData = [];

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
    series: seriesData
  });
  graph.render();

  // Activate the hover effect and show the axes
  var hoverDetail = new Rickshaw.Graph.HoverDetail( { graph: graph });
  var xAxis = new Rickshaw.Graph.Axis.Time({ graph: graph });
  xAxis.render();
  var yAxis = new Rickshaw.Graph.Axis.Y({ graph: graph });
  yAxis.render();

}

// Utilities
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

  for (var pairId in traffic.pairData) {
    pair = traffic.pairData[pairId];

    speed = pair.speed;
    freeFlow = pair.freeFlow;
    travelTime = pair.travelTime;

    if (!isNaN(speed) && !isNaN(travelTime) && !isNaN(freeFlow)) {
      distance = travelTime/60*speed;
      denominator += distance;
      speedBelowFreeflow = freeFlow-speed;
      if (speedBelowFreeflow > 0) {
        numerator += speedBelowFreeflow*distance;
      }
    }
  }
  miseryIndex = numerator/denominator;
  return miseryIndex;
}


// Handle when the path is clicked or when an item is pulled from the drop-down
var pathClick = function(pairId, traffic) {
  activePairId = pairId;
  var pairData = traffic.pairData[pairId];
  if(pairData) {
    // Pull the historical data for the pair id
    $.ajax({
      url: 'data/'+pairId+".json",
    }).done(function(percentiles) {
      activePercentiles = percentiles;


      // Show the PairId Title (Name)
      title = pairData.title.slice(0,60);
      if (pairData.title.length > 60) {
        title += '...';
      }
      $('#title').html(title);

      // Show the Speed and Travel Time
      $('#speed').html(Math.round(pairData.speed));
      $('#travelTime').html(Math.round(pairData.travelTime/60));

      // Show the Congestion Ratio
      var congestionRatio = pairData.speed/pairData.freeFlow;
      var color;
      if (congestionRatio > 0.9) {
        color = 'rgb(142,204,158)';
        text = 'normal';
      } else if (congestionRatio > 0.4) {
        color = 'rgb(250,189,137)';
        text = 'impacted';
      } else {
        color = 'rgb(248,157,154)';
        text = 'congested';
      }
      $('#site-status').css('background-color',color);
      $('#site-status-text').html(text);


      d3.select('.segment-selected').classed('segment-selected', false);  // Remove Existing Value
      d3.select('#svg-pairid-'+pairId).classed('segment-selected', true);
      activePairId = pairId;

      distance = pairData.travelTime/60*pairData.speed;
      activeDistance = distance;
      renderGraph(pairData.today,pairData.predictions,percentiles,distance);

      // Render Current Location
      var charts = $('#charts')
      charts.fadeIn(200);
    });
  };
};

function initializeTypeahead(traffic) {

  // Generate the typeahead dataset
  var pairs = traffic.pairData
  typeaheadData = []
  for (pairId in pairs) {
    typeaheadDatum = {};
    typeaheadDatum['pairName'] = pairs[pairId].title.slice(0,60);
    typeaheadDatum['pairId'] = pairId;
    typeaheadData.push(typeaheadDatum);
  }

  // Initialize the bloodhound suggestion engine
  var numbers = new Bloodhound({
    datumTokenizer: function(d) { return Bloodhound.tokenizers.whitespace(d.pairName); },
    queryTokenizer: Bloodhound.tokenizers.whitespace,
    local: typeaheadData
  });
  numbers.initialize();

  // Instantiate the typeahead UI
  $('.example-numbers').typeahead(null, {
    displayKey: 'pairName',
    source: numbers.ttAdapter()
  });
  $('.example-numbers').bind('typeahead:selected', function (event, suggestion, dataSet) {
    pathClick(suggestion.pairId, traffic);
  });
}

function renderRoads(traffic, roads, idMap) {
  mapElement = $("#map-canvas");

  var width = mapElement.width(),
    height = mapElement.height();

  var svg = d3.select("#map-canvas").append("svg")
    .attr("width", width)
    .attr("height", height);

  var projection = d3.geo.albers()
    .center([-70.95, 41.95])
    .parallels([38,46])
    .rotate([0, 0])
    .scale(23000)
    .translate([width / 2, height / 2]);

  var zoom = d3.behavior.zoom()
    .translate([0, 0])
    .scale(1)
    .scaleExtent([1, 8])
    .on("zoom", zoomed);

  var roadFeature = svg.selectAll("path")
    .data(roads.features)
    .enter().append("path")
    .attr("d", d3.geo.path().projection(projection))
    .attr('id', function(d, i) {
      return 'svg-pairid-'+idMap[d.properties.UniqueID];
    })
    .attr('class','segment')
    .on('click',function(d, i) {
      pathClick(idMap[d.properties.UniqueID], traffic);
    })
  svg.call(zoom);

  function zoomed() {
    roadFeature.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    roadFeature.style("stroke-width", 1.2 / zoom.scale());
  }

};


// Data Retrieval
function getData() {

  // Get Traffic, ID Map, and Get Roadway Layout
  $.when(
    $.getJSON("current.json"),
    $.getJSON("data/idMap.json"),
    $.getJSON("data/roads.json")
  ).then( function (trafficResults, idMapResults, roadsResults) {

    var traffic = trafficResults[0];
    var roads = roadsResults[0];
    var idMap = idMapResults[0];

    activeTraffic = traffic
    renderMiseryIndex(traffic);
    initializeTypeahead(traffic);
    renderRoads(traffic, roads, idMap);
  });

}

getData();
initializeEvents();
setPercentileTabDateLabel();
