var map;
var roadSegmentStrokeColor = 'rgb(99,76,124)';
var selectedRoadSegmentStrokeColor = 'rgb(197,253,115)';
var highlightedRoadSegmentStrokeColor = 'rgb(232,186,180)';
var highlightedRouteSegment;
var routeSegments = [];
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

// Load the Current Dataset
$.ajax({
  url: "current.json",
}).done(function( data ) {
  currentData = data
});

var pathClick = function(path) {
  var pairData = currentData.pairData[path.pairId];
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
  var selectedRouteSegment = routeSegments[path.pathIndex];
  selectedRouteSegment.setOptions({strokeColor: selectedRoadSegmentStrokeColor, strokeOpacity: 1.0});
  
  var charts = $('#charts')
  charts.fadeIn(200);

  
};

var pathMouseover = function(path) {
  if (highlightedRouteSegment) {
    removePathMouseover(path);
  }
  highlightedRouteSegment = routeSegments[path.pathIndex];
  highlightedRouteSegment.setOptions({strokeColor: highlightedRoadSegmentStrokeColor, strokeOpacity: 1.0});
};

var removePathMouseover = function(path) {
  if (highlightedRouteSegment) {
    highlightedRouteSegment.setOptions({strokeColor: (highlightedRouteSegment == selectedRouteSegment ? selectedRoadSegmentStrokeColor : roadSegmentStrokeColor)});
    highlightedRouteSegment.setOptions({strokeOpacity: (highlightedRouteSegment == selectedRouteSegment ? 1.0 : 0.5)});
  }
}

function initialize() {
  var mapOptions = {
    center: new google.maps.LatLng(42.358056, -71.063611),
    zoom: 9
  };
  map = new google.maps.Map(document.getElementById('map-canvas'),mapOptions);

  for (var i=0; i<segments.length; i++) {
    var addSegment = function(segmentData) {
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
      google.maps.event.addListener(path, 'click', function() {
        pathClick(path);
      });
      google.maps.event.addListener(path, 'mouseover', function() {
        pathMouseover(path);
      });
      google.maps.event.addListener(path, 'mouseout', function() {
        removePathMouseover(path);
      });
      path.setMap(map);
      routeSegments.push(path);
    };
    addSegment(segments[i]);
  }
}
google.maps.event.addDomListener(window, 'load', initialize);