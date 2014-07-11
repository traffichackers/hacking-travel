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
        renderGraph(activeTraffic.pairData[activePairId].today, activePercentiles, activeDistance);
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

function renderGraph(today, percentiles, distance) {
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
    percentileLevel = parseInt(key.slice(1));

    // Fix number formatting
    percentile = fixFormatting(percentile, distance)

    // Push each percentile for rendering
    seriesElement = {};
    seriesElement.data = percentile;
    alpha = (1-Math.abs(percentileLevel-50)/50)*0.4;
    seriesElement.color = 'rgba(70,130,180,'+alpha+')';
    seriesElement.name = percentileLevel+"th Percentile"
    seriesData.push(seriesElement);
  }

  // Add the Data for Today
  today = fixFormatting(today, distance)
  seriesElement = {};
  seriesElement.data = today;
  seriesElement.color = 'rgba(70,130,180,0.7)';
  seriesElement.name = "Today";
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

  // Pull the historical data for the pair id
  $.ajax({
    url: 'data/'+pairId+".json",
  }).done(function(percentiles) {
    activePercentiles = percentiles;
    var pairData = traffic.pairData[pairId];

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


    // Color the Selected Route Segment
    if (selectedRouteSegment) {
      selectedRouteSegment.setOptions({strokeColor: roadSegmentStrokeColor});
    }
    selectedRouteSegment = pairData.path;
    selectedRouteSegment.setOptions({strokeColor: selectedRoadSegmentStrokeColor, strokeOpacity: 1.0});

    distance = pairData.travelTime/60*pairData.speed;
    activeDistance = distance;
    renderGraph(pairData.today,percentiles,distance);

    // Render Current Location
    var charts = $('#charts')
    charts.fadeIn(200);
  });
};

function pathMouseover(path) {
  if (highlightedRouteSegment) {
    removePathMouseover(path);
  }
  highlightedRouteSegment = path
  highlightedRouteSegment.setOptions({strokeColor: highlightedRoadSegmentStrokeColor, strokeOpacity: 1.0});
};

function removePathMouseover() {
  if (highlightedRouteSegment) {
    highlightedRouteSegment.setOptions({strokeColor: (highlightedRouteSegment == selectedRouteSegment ? selectedRoadSegmentStrokeColor : roadSegmentStrokeColor)});
    highlightedRouteSegment.setOptions({strokeOpacity: (highlightedRouteSegment == selectedRouteSegment ? 1.0 : 0.5)});
  }
}

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

function renderRoads(roads, idMap) {

  var width = 700,
    height = 700;

  var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);

  var projection = d3.geo.albers()
    .center([-71.08, 42.36])
    .parallels([38,46])
    .rotate([0, 0])
    .scale(24000)
    .translate([width / 2, height / 2]);

  svg.selectAll("path")
    .data(roads.features)
    .enter().append("path")
    .attr("d", d3.geo.path().projection(projection))
    .attr('style','fill:none; stroke:black; strokeColor:roadSegmentStrokeColor; strokeOpacity:0.5, strokeWeight:2')
    .on('mouseover',function(testArg) {
      console.log(testArg);
      pathMouseover(path);
    })
    .on('mouseout',function(testArg) {
      removePathMouseover();
    })
    .on('click',function(testArg) {
      pathClick(pairId,traffic);
    })
    .each( function(d, i) {
      var pairId = idMap[d.properties.UniqueId]
      if (traffic.pairData.hasOwnProperty(pairId)) {
        traffic.pairData[pairId]['path'] = path;
      }
    });
};


// Data Retrieval
function getData() {

  // Get Traffic
  $.ajax({ url: "current.json" }).done( function(traffic) {
    activeTraffic = traffic
    renderMiseryIndex(traffic);
    initializeTypeahead(traffic);
  });

  // Get Roadway Layout and ID Map
  $.when( $.getJSON("data/id.json"), $.getJSON("data/roads.json") ).then(function( roads, idMap ) {
    renderRoads(roads, idMap);
  });

}

getData();
initializeEvents();
setPercentileTabDateLabel();
