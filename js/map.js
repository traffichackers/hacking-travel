var map;
var roadSegmentStrokeColor = 'rgb(99,76,124)';
var selectedRoadSegmentStrokeColor = 'rgb(197,253,115)';
var highlightedRoadSegmentStrokeColor = 'rgb(232,186,180)';
var highlightedRouteSegment;
var selectedRouteSegment = null;
var highlightedRouteSegment = null;
var currentData;

// Set the Date Tab Value
var setDateTab = function() {
  now = new Date()
  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  day = 'Previous '+days[now.getDay()]+'s'
  $('#doy').html(day)
}()

var pathClick = function(pairId, traffic) {
  var pairData = traffic.pairData[pairId];
  $('#title').html(pairData.title.slice(0,60)+'...');
  $('#speed').html(Math.round(pairData.speed));
  $('#travelTime').html(Math.round(pairData.travelTime/60));
  var congestionRatio = pairData.speed/pairData.freeFlow
  var color
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
  $('#site-status').css('background-color',color)
  $('#site-status-text').html(text)

  
  if (selectedRouteSegment) {
    selectedRouteSegment.setOptions({strokeColor: roadSegmentStrokeColor})
  }
  selectedRouteSegment = pairData.path;
  selectedRouteSegment.setOptions({strokeColor: selectedRoadSegmentStrokeColor, strokeOpacity: 1.0});
  
  var charts = $('#charts')
  charts.fadeIn(200);
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
    initializeTypeahead(traffic);
    initializeMap(traffic);
  });
}

getTraffic();



var graph = new Rickshaw.Graph({
  element: document.querySelector("#historicalTravelTimes"),
    renderer: 'line',
    series: [{
      data: [ { x: 0, y: 40 }, { x: 1, y: 49 }, { x: 2, y: 54 }, { x: 3, y: 60 } ],
      color: 'steelblue'
    }, {
      data: [ { x: 0, y: 20 }, { x: 1, y: 23 }, { x: 2, y: 28 }, { x: 3, y: 36 } ],
      color: 'lightblue'
    }]
  });
graph.render();