// Events
var events = {

  initializeEvents: function(traffic, graphData) {
    events.initializeTypeahead(traffic, graphData);
    renderers.setPercentileTabDowLabel();
  },

  setGraphControlEvents: function(pairDatum, graphData) {
    $('.type-button').off('click');
    $('.type-button').on('click', function (){
      $('.subselects').css('display','none');
      section = '#'+$(this).attr('id')+'-subselects';
      $(section).css('display','inline-block');
      $('.type-button').removeClass('active');
      $(this).addClass('active');
      renderers.renderGraph(pairDatum, graphData);
    });
    $('.subselects-button').off('click');
    $('.subselects-button').on('click', function (){
      var type = $('.type-button.active').attr('id');
      $('#'+type+'-subselects > .subselects-button').removeClass('active')
      $(this).addClass('active');
      renderers.renderGraph(pairDatum, graphData);
    });
  },

  initializeTypeahead: function(traffic, graphData) {
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
      events.pathSelect(suggestion.pairId, traffic.pairData, graphData);
    });
  },

  // Handle when the path is clicked or when an item is pulled from the drop-down
  pathSelect: function(pairId, pairData, graphData) {
    //console.log(pairId);
    pairDatum = pairData[pairId];
    if (pairDatum) {

      // Show the Header
      $('#segment-title').html(pairDatum.title)
      $('#speed').html(Math.round(pairDatum.speed));
      $('#travelTime').html(Math.round(pairDatum.travelTime/60));
      var congestionRatioText = helper.getCongestionRatioText(pairDatum)
      $('#site-status').removeClass (function (index, css) {
        return (css.match (/(^|\s)status-\S+/g) || []).join(' ');
      });
      $('#site-status').addClass('status-'+congestionRatioText);
      $('#site-status-text').html(congestionRatioText);

      // Remove segment highlighting on the previous segment (if any) and add to the ne segment
      d3.select('.segment-selected').classed({'segment':true, 'segment-selected':false});
      d3.select('#svg-pairid-'+pairId).classed({'segment':true, 'segment-selected':true});

      // Draw the graph
      renderers.renderGraph(pairDatum, graphData);
      events.setGraphControlEvents(pairDatum, graphData);

      // Hide the region section and show the segment section
      $('.detail-region').addClass('detail-hidden');
      $('#charts').removeClass('detail-hidden');
    };
  }
};

// Renderers
var renderers = {
  setPercentileTabDowLabel: function() {
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    dow = helper.getDayOfWeek();
    $('#dow').html(days[dow]+'s');
    if (dow === 0 || dow === 6) {
      $('#dowtype').html('Weekends');
      $('#dowtype').attr('data-type','weekends')
    } else {
      $('#dowtype').html('Weekdays');
      $('#dowtype').attr('data-type','weekdays')
    }
    $('#'+days[dow].toLowerCase()).addClass('active',true);
  },

  renderRoads: function(traffic, roads, backgroundRoads, graphData) {
    var headerElement = $("#header");
    var documentElement = $(document)
    var width = documentElement.width() - 6;
    var height = documentElement.height() - headerElement.height() - 6;
    svg = d3.select("#map-canvas-svg")
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
      .style('stroke', function(d, i) {
        var pairDatum = traffic.pairData[d.properties.SegmentID];
        if (pairDatum) {
          var congestionRatioText = helper.getCongestionRatioText(pairDatum);
          var colors = {
            normal: "rgb(142,204,158)",
            impacted: "rgb(250,189,137)",
            congested: "rgb(248,157,154)"
          }
          return colors[congestionRatioText];
        } else {
          return "rgb(160,160,160)";
        }
      })
      .attr("d", d3.geo.path().projection(projection))
      .attr('id', function(d, i) {
        return 'svg-pairid-'+d.properties.SegmentID;
      })
      .attr('data-title', function(d, i) {
        try {
          return d.properties.Full_Desc
        } catch (e) {
          return ''
        }
      })
      .attr('class','segment')
      .on('click',function(d, i) {
        events.pathSelect(d.properties.SegmentID, traffic.pairData, graphData);
      })
      .on('mouseover', function(d, i) {
        renderers.spotlightSegments(this, roadFeature);
      })
    svg.call(zoom);
    function zoomed() {
      roadFeature.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
      var strokeWidth = roadFeature.style("stroke-width");
      roadFeature.style("stroke-width", strokeWidth / zoom.scale());
    }
  },

  renderGraph: function (pairDatum, graphData) {

    var distance = pairDatum.travelTime/60*pairDatum.speed;
    var seriesData = [];

    // Select the proper percentile
    var type = 'similar'; //$('.type-button.active').attr('id');
    var subselect = 'dow'; //$('#'+type+'-subselects > .subselects-button.active').attr('data-type');

    // Prepare each percentile
    var predictions = graphData.similar_dow[pairDatum.pairId]['50'];
    var todayStart = new Date(graphData.today.Start);
    var minToday = todayStart.getTime()/1000;
    var predictionsStart = new Date(graphData.similar_dow.Start+"-05:00");
    var maxPredictions = predictionsStart.getTime()/1000+predictions.length*5*60;
    var maxPoints = (predictionsStart.getTime()-todayStart.getTime())/(1000*60*5)+predictions.length;
    var chosenPercentiles = graphData[type+'_'+subselect][pairDatum.pairId];
    if (type === 'all') {
	  var chosenPercentilesStart = graphData.today.Start;
	} else {
	  var chosenPercentilesStart = graphData[type+'_'+subselect].Start;
	}

    var percentileOrder = ['min', '10', '25', '50', '75', '90', 'max']
    for (var i=0; i<percentileOrder.length; i++) {
      var chosenPercentile = chosenPercentiles[percentileOrder[i]];
	  if (type === 'all') {
		var seriesElement = helper.prepareGraphSeries(chosenPercentile, percentileOrder[i], 'area', distance, chosenPercentilesStart, false, maxPoints);
	  } else {
		var seriesElement = helper.prepareGraphSeries(chosenPercentile, percentileOrder[i], 'area', distance, chosenPercentilesStart, true, maxPoints);
	  }
	  seriesData.push(seriesElement);
    }

    // Add Vertical Line for Today
    var seriesElement = {};
    var currentTime = new Date(graphData.similar_dow.Start+"-05:00");
    var currentTimeSeconds = (currentTime.getTime())/1000;
    seriesElement.data = [{'x':currentTimeSeconds,'y':0}, {'x':currentTimeSeconds, 'y':84}];
    seriesElement.color = 'rgb(145,196,245)';
    seriesElement.renderer = 'line';
    seriesElement.name = 'Now';
    seriesData.push(seriesElement);

    // Add the Data for Today
    var today = graphData.today[pairDatum.pairId];
    var todayStart = graphData.today.Start;
    var seriesElement = helper.prepareGraphSeries(today, 'Earlier Today', 'line', distance, todayStart, false);
    seriesData.push(seriesElement);

    // Add the Predictions
    var predictions = graphData.similar_dow[pairDatum.pairId]['50'];
    var predictionsStart = graphData.similar_dow.Start
    var seriesElement = helper.prepareGraphSeries(predictions, 'Predictions', 'line', distance, predictionsStart, true);
    seriesData.push(seriesElement);

    // Render the new graph
    var graph = new Rickshaw.Graph({
      element: document.querySelector("#graph-"+pairDatum.pairId),
      renderer: 'multi',
      unstack: true,
      series: seriesData,
      width: 550,
      height: 200
    });
    graph.render();

    // Activate the hover effect and show the axes
    var hoverDetail = new Rickshaw.Graph.HoverDetail( {
      graph: graph,
      xFormatter: function(x) {
        var tempDate = new Date(x*1000);
        return tempDate.toLocaleDateString() + " " + tempDate.toLocaleTimeString();
      },
      yFormatter: function(y) {
        if (y === 0) {
          return "divides historical traffic from predictions"
        } else {
          return Math.round(y)+" mph";
        }
      }
    });
    var format = function(d) {
      d = new Date(d)
      return d.toISOString().substr(11,5)
    }
    var unit = {}
    unit.formatTime = function(d) {
      var localeTimeString = d.toLocaleTimeString();
      return localeTimeString.substr(0,4)+localeTimeString.substr(7,10);
    };
    unit.formatter = function(d) {
      return this.formatTime(d);
    };
    unit.name = "hour";
    unit.seconds = 21600;
    var xAxis = new Rickshaw.Graph.Axis.Time({
      graph: graph,
      timeUnit:unit,
      timeFixture: new Rickshaw.Fixtures.Time.Local()
    });
    xAxis.render();
    var yAxis = new Rickshaw.Graph.Axis.Y({
      graph: graph,
      tickFormat: Rickshaw.Fixtures.Number.formatKMBT,
      tickValues: [25,50,75,100]
    });
    yAxis.render();
    /*
    var annotator = new Rickshaw.Graph.Annotate({
      graph: graph,
      element: document.getElementById('timeline')
    });
    annotator.add(1412039701, "You are here");
    annotator.update();
    */
  },

  addSegmentLabel: function(roadFeature, transformation) {
    var transformations = []
    transformations.push(transformation);

    // Remove labels from paths in prior generations
    d3.selectAll('.segment-label').remove();

    // Add labels to newly translated paths
    var texts = roadFeature.selectAll("text").data(transformations).enter();
    texts.append("text")
    .text(function(d, i) {
      if (typeof d === 'undefined' || d.name === 'undefined') {
        return '';
      } else {
        return d.name;
      }

    })
    .attr('class', 'segment-label')
    .attr('x', function(d, i) {
      return d.boundaries.x1 + 10;
    })
    .attr('y', function(d, i) {
      return d.boundaries.y1 - 10;
    })

  },

  spotlightSegments: function(activeSegment, roadFeature) {
    if (activeSegment.className.baseVal.indexOf('segment-flyout') === -1) {
    //if (!activeSegment.classList.contains('segment-flyout')) {

      var spotlightRadius = 5;
      var priorTransformations = [];

      // Remove previous generation segment flyouts, if any
      d3.selectAll('.segment-flyout').classed('segment-flyout',false)

      // Calculate the center of mass for all segments within the spotlightRadius
      var com = rendererHelpers.getCentroid(activeSegment, roadFeature, spotlightRadius)

      // See the transform attribute on the road segments
      var activeBoundaries = rendererHelpers.getBoundaries(activeSegment);
      var activeBoundariesWithMargin = rendererHelpers.addMargin(activeBoundaries, spotlightRadius);
      d3.selectAll('.segment')
        .transition()
        .duration(750)
        .attr('transform', function(d, i) {
          var currentBoundaries = rendererHelpers.getBoundaries(this);

          // Determine if current segment is close to the active segment
          currentSegmentMidpoint = this.getPointAtLength(this.getTotalLength()/2);
          var epicenterDistance = rendererHelpers.calculateDistance(com, currentSegmentMidpoint);
          if (activeSegment.id === this.id) {
            d3.select(this).classed('segment-nonflyout',false);
            d3.select(this).classed('segment-flyout',true);
            d3.select(this).attr('marker-end','url(#segment-direction)');

            // Render label on mouseover
            d3.select(this).on('mouseover', function(d, i) {
              renderers.addSegmentLabel(roadFeature,priorTransformation);
            })

          } else if (activeSegment.id !== this.id && rendererHelpers.hasOverlap(activeBoundariesWithMargin, currentBoundaries)) {
            //console.log(this.id);
            var offsetVector = rendererHelpers.getOffsetVector(this, priorTransformations, currentSegmentMidpoint, com, currentBoundaries);
            //console.log("     ");

            // Store a record of this transformation
            var currentSegmentEnd = this.getPointAtLength(this.getTotalLength());
            var priorTransformation = {
              'name': d3.select(this).attr('data-title'),
              'boundaries': rendererHelpers.translateBoundaries(currentBoundaries,offsetVector)

            }
            priorTransformations.push(priorTransformation);

            // Set Flyout Formatting
            d3.select(this).classed('segment-nonflyout',false);
            d3.select(this).classed('segment-flyout',true);
            if (typeof activeSegment.classList !== 'undefined') {
              d3.select(this).attr('marker-end','url(#segment-direction)');
            }

            // Render label on mouseover
            d3.select(this).on('mouseover', function(d, i) {
              renderers.addSegmentLabel(roadFeature,priorTransformation);
            })

            // Return the Translation
            return 'translate('+offsetVector.x+','+offsetVector.y+')';

          // Return a zero translation if the current segment is not close to the active segment
          } else {
            d3.select(this).classed('segment-nonflyout',true);
            d3.select(this).attr('marker-end','');
            return 'translate(0,0)';
          }
        }
      );

    }

  }

}

var helper = {
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
  },

  prepareGraphSeries: function(unformattedData, level, renderer, distance, start, utc, maxPoints) {

    var seriesElement = {};
    var data = [];
    var formattedDatum;
	if (utc === true) {
		var currentTime = new Date(start+"-05:00");
	} else {
	  var currentTime = new Date(start);
	}
    var currentTimeSeconds
    currentTimeSeconds = currentTime.getTime()/1000;

    for (var i=0; i<unformattedData.length; i++) {
      if (i<=maxPoints || typeof maxPoints === 'undefined' ) {
        formattedDatum = {'x':currentTimeSeconds,'y':distance/(unformattedData[i]/60)};
        data.push(formattedDatum);
        currentTimeSeconds = currentTimeSeconds + 5*60000/1000;
      }

    }

    var name = level
    var seriesElement = {};
    seriesElement.data = data;

    // Set Name
    nameMap = {
      'max':'Min',
      '90':'10th Percentile',
      '75':'25th Percentile',
      '50':'50th Percentile',
      '25':'75th Percentile',
      '10':'90th Percentile',
      'min':'Max'
    }
    var mappedName = nameMap[name];
    if (typeof mappedName !== 'undefined') {
      seriesElement.name = mappedName
    } else {
      seriesElement.name = name
    }

    // Set Color
    var inner = 'rgb(190,190,190)';
    var mid = 'rgb(210,210,210)';
    var outer = 'rgb(240,240,240)';
    levels = {
      'Min':'rgb(255,255,255)',
      '10th Percentile':outer,
      '25th Percentile':mid,
      '50th Percentile':inner,
      '75th Percentile':inner,
      '90th Percentile':mid,
      'Max':outer,
      'Predictions':'rgb(243,154,29)',
      'Earlier Today': 'rgb(135,135,135)',
      'Now':'rgb(0,0,255)'
    }
    seriesElement.color = levels[seriesElement.name]

    seriesElement.renderer = renderer
    return seriesElement;
  },

  getActivePercentileTab: function() {
    return $('.percentile-graphs').children('.active').attr('id');
  },

  getDayOfWeek: function() {
    now = new Date();
    return now.getDay();
  },

  getMiseryIndex: function(traffic, pairIds) {
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
        if (pairIds.indexOf(parseInt(pairId)) !== -1 || typeof pairIds === 'undefined') {
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
    }
    miseryIndex = numerator/denominator;

    // Sort the impacted segments
    impactedSegments = _.sortBy(impactedSegments, function(segment){ return -1*segment.speedBelowFreeflow });
    impactedSegments = impactedSegments.slice(0,10);

    return {
      'miseryIndex': Math.round( miseryIndex * 10) / 10,
      'speed': Math.round(speedSummation/count),
      'freeFlow': Math.round(freeflowSummation/count),
      'impactedSegments': impactedSegments
    }
  }
}

var rendererHelpers = {

  calculateDistance: function (point1, point2) {
    return Math.sqrt(Math.pow(point1.x-point2.x,2) + Math.pow(point1.y-point2.y,2));
  },

  translateBoundaries: function (boundaries,translationVector) {
    returnBoundaries = {}
    returnBoundaries.x1 = boundaries.x1+translationVector.x;
    returnBoundaries.x2 = boundaries.x2+translationVector.x;
    returnBoundaries.y1 = boundaries.y1+translationVector.y;
    returnBoundaries.y2 = boundaries.y2+translationVector.y;
    return returnBoundaries;
  },

  getBoundaries: function (path) {
    var boundingBox = path.getBBox();
    return {
      'x1': boundingBox.x,
      'y1': boundingBox.y,
      'x2': boundingBox.x+boundingBox.width,
      'y2': boundingBox.y+boundingBox.height
    };
  },

  expand: function(orig) {
    var out = {};
    var expansion = 5;
    out.x1 = orig.x1-expansion;
    out.x2 = orig.x2+expansion;
    out.y1 = orig.y1-expansion;
    out.y2 = orig.y2+expansion;
    return out;
  },

  hasOverlap: function (aOrig, bOrig) {

    // Enlarge a and b
    var a = rendererHelpers.expand(aOrig);
    var b = rendererHelpers.expand(bOrig);

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

  },

  addMargin: function (box, margin) {
    box.x1 = box.x1-margin;
    box.x2 = box.x2+margin;
    box.y1 = box.y1-margin;
    box.y2 = box.y2+margin;
    return box;
  },

  getNormalVectors: function (segment) {

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
  },

  getCentroid: function(activeSegment, roadFeature, spotlightRadius) {

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
      var epicenterDistance = rendererHelpers.calculateDistance(activeSegmentMidpoint,midPoint);
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
  },

  getCloserIndex: function(csm, com, offsetVectors) {
    var closerIndex;
    var distance, candidateDistance
    for (var i=0; i<offsetVectors.length; i++) {
      offsetVector = offsetVectors[i];
      if (typeof offsetVector !== 'undefined') {
        translatedCsm = {'x': csm.x+offsetVector.x, 'y': csm.y+offsetVector.y }
        candidateDistance = rendererHelpers.calculateDistance(com,translatedCsm);
        if (typeof distance == 'undefined' || candidateDistance <= distance) {
          closerIndex = i;
        }
      }
    }
    return closerIndex;
  },

  applyNormalVectorMultiplier: function(normalVector, multiplier) {
    offsetVector = {};
    offsetVector.x = normalVector.x*multiplier;
    offsetVector.y = normalVector.y*multiplier;
    return offsetVector
  },

  getOffsetVector: function(currentSegment, queuedTransformations, currentSegmentMidpoint, com, currentBoundaries) {
    var baseMultiplier = 7;
    var multiplier = baseMultiplier;

    // Calculate the normal vectors
    var normalVectors = rendererHelpers.getNormalVectors(currentSegment);

    // Calcuate the base offset
    var offsetVectors = [];
    var closerIndex = rendererHelpers.getCloserIndex(currentSegmentMidpoint, com, normalVectors);
    offsetVectors[closerIndex] = rendererHelpers.applyNormalVectorMultiplier(normalVectors[closerIndex], multiplier)

    // Check if the base offset has any collisions
    var translatedBoundaries = rendererHelpers.translateBoundaries(currentBoundaries,offsetVectors[closerIndex]);
    for (var j=0; j<queuedTransformations.length; j++) {
      var previousBoundaries = queuedTransformations[j].boundaries;
      if (rendererHelpers.hasOverlap(translatedBoundaries, previousBoundaries)) {
        //console.log('has overlap');
        //console.log('  previousCollision: '+JSON.stringify(queuedTransformations[j]));
        multiplier += baseMultiplier;
        offsetVectors[closerIndex] = rendererHelpers.applyNormalVectorMultiplier(normalVectors[closerIndex], multiplier)
        closerIndex = rendererHelpers.getCloserIndex(currentSegmentMidpoint, com, offsetVectors);
        translatedBoundaries = rendererHelpers.translateBoundaries(currentBoundaries,offsetVectors[closerIndex]);
        //console.log("  translatedBoundaries: "+JSON.stringify(translatedBoundaries));
        j = 0;
      }
    }
    return offsetVectors[closerIndex];
  }
}

// Get Data and Initialize
var graphData = {};
$.when(
  $.getJSON("data/predictions/similar_dow.json"),
  $.getJSON("data/today.json"),
  $.getJSON("data/current.json")
).then( function (similarDowResults, todayResults, trafficResults) {
  graphData.similar_dow = similarDowResults[0];
  graphData.today = todayResults[0];
  var traffic = trafficResults[0];

  /*
  zones = {
    'north': {"northbound": [5587, 5574, 5572, 5511, 5556], "southbound": [5557, 5559, 5573, 5575, 5588] },
    'south': {"northbound": [10193, 10190, 10189, 10188, 10187, 14669, 5506], "southbound": [14670, 10182, 10181, 10180, 10179, 10178, 5501]},
    'west': {"westbound": [10088, 10086, 10085, 10389, 10386, 10385, 10382, 10357, 10356], "eastbound": [10361, 10499, 10379, 10376, 10375, 10374, 10238, 10083, 10082] },
    'cape': {"westbound": [14681, 14697, 14679, 14691, 14683, 14685, 14687, 14689, 14693, 14695, 14717, 14722], "eastbound": [14686, 14680, 14690, 14682, 14692, 14684, 14698, 14688, 14694, 14748, 14696, 14747]}
  }
  */

  zones = {
    'north': [5587] //, 5574, 5572, 5511, 5556, 5557, 5559, 5573, 5575, 5588]
    ,'south': [10193] //, 10190, 10189, 10188, 10187, 14669, 5506, 14670, 10182, 10181, 10180, 10179, 10178, 5501]
    ,'west': [10088] //, 10086, 10085, 10389, 10386, 10385, 10382, 10357, 10356, 10361, 10499, 10379, 10376, 10375, 10374, 10238, 10083, 10082]
    //,'cape': [14681, 14697, 14679, 14691, 14683, 14685, 14687, 14689, 14693, 14695, 14717, 14722, 14686, 14680, 14690, 14682, 14692, 14684, 14698, 14688, 14694, 14748, 14696, 14747]
  }
  // Show speed and misery index
  for (zoneName in zones) {
    var zonePairIds = zones[zoneName];
    var regionalConditions = helper.getMiseryIndex(traffic, zonePairIds);
    $('#detail-region-' + zoneName + ' .average-region-speed').html(regionalConditions.speed);
    $('#detail-region-' + zoneName + ' .misery-index').html(regionalConditions.miseryIndex);

    // Show the congestion ratio
    var congestionRatioText = helper.getCongestionRatioText(regionalConditions)
    $('#detail-region-' + zoneName + ' .average-region-status').addClass('status-'+congestionRatioText);
    $('#detail-region-' + zoneName + ' .average-region-status-text').html(congestionRatioText);

    // Coalesce Speeds
    var numerator = 0;
    var denominator = 0;
    var distance;
    var zonePairDatum = {};
    var pairDatum;
    var travelTimes = 0;
    var counter = 0;
    for (pairId in traffic.pairData)
      if (zonePairIds.indexOf(parseInt(pairId)) !== -1) {
        pairDatum = traffic.pairData[pairId];
        travelTimes += pairDatum.travelTime;
        distance = pairDatum.travelTime/60*pairDatum.speed;
        numerator += pairDatum.speed*distance;
        denominator += distance;
        counter++
      }
    zonePairDatum.speed = numerator/denominator;
    zonePairDatum.travelTime = travelTimes/counter;
    zonePairDatum.pairId = zoneName;

    // Coalesce similar_dow
    var numerator = {};
    var denominator = {};
    var pairDatum, distance, percentiles, travelTimes;
    for (pairId in graphData.similar_dow) {
      if (zonePairIds.indexOf(parseInt(pairId)) !== -1) {
        pairDatum = traffic.pairData[parseInt(pairId)];
        if (typeof pairDatum !== 'undefined') {
          distance = pairDatum.travelTime/60*parseInt(pairDatum.speed);
          percentiles = graphData.similar_dow[parseInt(pairId)];
          for (percentile in percentiles) {
            if (typeof numerator[percentile] === 'undefined') {
              numerator[percentile] = []
            }
            if (typeof denominator[percentile] === 'undefined') {
              denominator[percentile] = []
            }
            travelTimes = percentiles[percentile];
            for (var i=0; i<travelTimes.length; i++) {
              if (typeof numerator[percentile][i] === 'undefined') {
                numerator[percentile][i] = 0;
              }
              if (typeof denominator[percentile][i] === 'undefined') {
                denominator[percentile][i] = 0;
              }
              numerator[percentile][i] += travelTimes[i]*distance
              denominator[percentile][i] += distance
            }
          }
        }
      }
    }
    var currentNumerator;
    var currentDenominator;
    var similarDow = {};
    similarDow[zoneName] = {};
    for (percentile in numerator) {
      currentNumerator = numerator[percentile];
      currentDenominator = denominator[percentile];
      if (typeof similarDow[percentile] === 'undefined') {
        similarDow[zoneName][percentile] = []
      }
      for (var i=0; i<currentNumerator.length; i++) {
        similarDow[zoneName][percentile][i] = currentNumerator[i]/currentDenominator[i];
      }
    }
    similarDow.Start = graphData.similar_dow.Start;

    // Coalesce today
    var numerator = [];
    var denominator = [];
    var pairDatum, distance, percentiles, travelTimes;
    for (pairId in graphData.today) {
      if (zonePairIds.indexOf(parseInt(pairId)) !== -1) {
        pairDatum = traffic.pairData[pairId];
        distance = pairDatum.travelTime/60*parseInt(pairDatum.speed);
        travelTimes = graphData.today[pairId];
        for (var i=0; i<travelTimes.length; i++) {
          if (typeof numerator[i] === 'undefined') {
            numerator[i] = 0;
          }
          if (typeof denominator[i] === 'undefined') {
            denominator[i] = 0;
          }
          numerator[i] += travelTimes[i]*distance
          denominator[i] += distance
        }
      }
    }
    var today = {};
    today[zoneName] = []
    for (var i=0; i<numerator.length; i++) {
      today[zoneName][i] = numerator[i]/denominator[i];
    }
    today.Start = graphData.today.Start;

    var zoneGraphData = {
      "similar_dow": similarDow,
      "today": today
    };
    renderers.renderGraph(zonePairDatum, zoneGraphData);
  }

  $('.sections').show()
});
