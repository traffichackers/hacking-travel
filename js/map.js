var map;
var roadSegmentStrokeColor = 'rgb(99,76,124)';
var selectedRoadSegmentStrokeColor = 'rgb(197,253,115)';
var highlightedRoadSegmentStrokeColor = 'rgb(232,186,180)';
var highlightedRouteSegment;
var selectedRouteSegment = null;
var highlightedRouteSegment = null;
var currentData;

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
        selectedTab.addClass('active')
        var tabs = $('.percentile-graphs').children()
        for (i = 0; i < tabs.length; i++) {
          currentTab = $(tabs[i]);
          if (currentTab.hasClass('active') && currentTab.attr('id') !== selectedTab.attr('id')) {
            currentTab.removeClass('active');
          }
        }
      }
    });
  }
}

// Utilities
var renderMiseryIndex = function (traffic) {
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

// Get Tab Status
activeTab = ''
if ($('ad').hasClass('active')) {
  activeTab = 'all';
} else if ($('doy').hasClass('active')) {
  activeTab = 'dow';
}

// Set the Date Tab Value
var setDateTab = function() {
  now = new Date();
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  dow = now.getDay();
  
  // Set Day
  day = 'Previous '+days[dow]+'s';
  $('#doy').html(day);
  
}()

// Handle when the path is clicked or when an item is pulled from the drop-down
var pathClick = function(pairId, traffic) {

  // Pull the historical data for the pair id
  $.ajax({
    url: 'data/'+pairId+".json",
  }).done(function(percentiles) {
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
    
    // Line Chart
    pairData.distance = pairData.travelTime/60*pairData.speed
    seriesData = [];
    if (activeTab === 'dow') {
      chosenPercentiles = percentiles.percentiles.dow[dow]
    } else {
      chosenPercentiles = percentiles.percentiles.all
    }
    
    for (key in chosenPercentiles) {
      percentile = chosenPercentiles[key];
      percentileLevel = parseInt(key.slice(1));
      
      // Fix number formatting
      for (var i=0; i<percentile.length; i++) {
        if (isNaN(percentile[i].x)) {
          hoursAndMinutes = percentile[i].x.split(':');
          newDate = new Date(1970, 0, 1, hoursAndMinutes[0], hoursAndMinutes[1]);
          percentile[i].x = newDate.getTime()/1000;
          percentile[i].y = pairData.distance/(percentile[i].y/60);
        }
      }
      seriesElement = {};
      seriesElement.data = percentile;
      alpha = Math.abs((percentileLevel-50)/85)*-1+0.7;
      seriesElement.color = 'rgba(70,130,180,'+alpha+')';
      seriesElement.name = percentileLevel+"th Percentile"
      seriesData.push(seriesElement);
    }
    $("#historicalTravelTimes").empty();
    var graph = new Rickshaw.Graph({
    element: document.querySelector("#historicalTravelTimes"),
      renderer: 'line',
      series: seriesData
    });
    graph.render();

    var hoverDetail = new Rickshaw.Graph.HoverDetail( {
      graph: graph
    } );
    
    var xAxis = new Rickshaw.Graph.Axis.Time({
        graph: graph
    });

    xAxis.render();
    var yAxis = new Rickshaw.Graph.Axis.Y({
        graph: graph
    });

    yAxis.render();
    
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

var addSegment = function(pairId,segmentData,i,traffic) {
  var paths = segmentData[1];

  // eg: [5490.0, [[42.71946, -71.20996], [42.71941, -71.20972], ...]
  var x1 = paths[0][0];
  var y1 = paths[0][1];
  var x2 = paths[1][0];
  var y2 = paths[1][1];
  var dx = x1-x2;
  var dy = y1-y2;
  var dist = Math.sqrt(dx*dx + dy*dy);
  dx = dx/dist;
  dy = dy/dist;
  var offset = 0.0;
  x3 = x1 + offset * dy;
  y3 = y1 - offset * dx;
  x4 = x1 - offset * dy;
  y4 = y1 + offset * dx;

  var segment = paths.map(function(point) {
    return new google.maps.LatLng(point[0] + (offset * dy), point[1] - (offset * dx));
  });

  var path = new google.maps.Polyline({
    path: segment,
    geodesic: true,
    strokeColor: roadSegmentStrokeColor,
    strokeOpacity: 0.5,
    strokeWeight: 2,
    pairId: segmentData[0],
    pathIndex: i
  });
  google.maps.event.addListener(path, 'mouseover', function() {
    pathMouseover(path);
  });
  google.maps.event.addListener(path, 'mouseout', function() {
    removePathMouseover();
  });
  google.maps.event.addListener(path, 'click', function() {
    pathClick(pairId,traffic);
  });
  traffic.pairData[pairId]['path'] = path;
  path.setMap(map);
  return path
};

function initializeMap(traffic) {
  var mapOptions = {
    center: new google.maps.LatLng(42.358056, -71.063611),
    zoom: 9
  };
  map = new google.maps.Map(document.getElementById('map-canvas'),mapOptions);

  for (var i=0; i<segments.length; i++) {
    var pairId = segments[i][0].toString();
    if (traffic.pairData.hasOwnProperty(pairId)) {
      addSegment(pairId,segments[i],i,traffic);
    }
  }
}

// Load the Current Dataset
function getTraffic() {
  $.ajax({
    url: "current.json",
  }).done(function(traffic) {
    renderMiseryIndex(traffic);
    initializeTypeahead(traffic);
    initializeMap(traffic);
  });
}

getTraffic();
initializeEvents();