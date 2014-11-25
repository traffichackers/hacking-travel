// Events
var events = {

  setZoneGraphControlEvents: function(pairDatum) {
    var graphIdentifier = pairDatum.pairId
    var typeButtons = $('#'+graphIdentifier+' .type-button')
    typeButtons.off('click');
    typeButtons.on('click', function (){
      var clickedElement = $(this);
      $(typeButtons).removeClass('active');
      clickedElement.addClass('active');
      var displayDataName = clickedElement.attr('data-display')
      renderers.renderGraph(pairDatum, graphData[pairDatum.pairId], displayDataName);
    });
  }
};

// Renderers
var renderers = {

  renderGraph: function (pairDatum, graphData, displayDataName) {
    $("#graph-"+pairDatum.pairId).html('');
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
	  var chosenPercentilesStart = graphData[displayDataName].Start;
	} else {
	  var chosenPercentilesStart = graphData[type+'_'+subselect].Start;
	}

    var percentileOrder = ['max', '90', '75', '50', '25', '10', 'min']
    for (var i=0; i<percentileOrder.length; i++) {
      var chosenPercentile = chosenPercentiles[percentileOrder[i]];

    if (displayDataName === 'today') {
  	  if (type === 'all') {
  		  var seriesElement = helper.prepareGraphSeries(chosenPercentile, percentileOrder[i], 'area', chosenPercentilesStart, false, maxPoints);
  	  } else {
  		  var seriesElement = helper.prepareGraphSeries(chosenPercentile, percentileOrder[i], 'area', chosenPercentilesStart, true, maxPoints);
  	  }
  	  seriesData.push(seriesElement);
      }
    }

    // Add Vertical Line for Today
    //if (displayDataName === 'today') {
      var seriesElement = {};
      var currentTime = new Date(graphData.similar_dow.Start+"-05:00");
      var currentTimeSeconds = (currentTime.getTime())/1000;
      seriesElement.data = [{'x':currentTimeSeconds,'y':0}, {'x':currentTimeSeconds, 'y':84}];
      seriesElement.color = 'rgb(145,196,245)';
      seriesElement.renderer = 'line';
      seriesElement.name = 'Now';
      seriesData.push(seriesElement);
    //}

    // Add the Predictions
    if (displayDataName === 'today') {
      var predictions = graphData.similar_dow[pairDatum.pairId]['50'];
      var predictionsStart = graphData.similar_dow.Start
      var seriesElement = helper.prepareGraphSeries(predictions, 'Predictions ', 'line', predictionsStart, true);
      seriesData.push(seriesElement);
    }

    // Add the Data for Today
    var today = graphData[displayDataName][pairDatum.pairId];
    var todayStart = graphData.today.Start;
    if (displayDataName === 'today') {
      var seriesElement = helper.prepareGraphSeries(today, 'Earlier Today', 'line', todayStart, false);
    } else {
      var seriesElement = helper.prepareGraphSeries(today, 'Past Thanksgiving', 'line', todayStart, false, maxPoints);
    }
    seriesData.push(seriesElement);

    // Render the new graph
    var graphWidth, graphHeight;
    if (window.innerWidth < 740) {
      graphWidth = window.innerWidth-40;
      graphHeight = graphWidth/550*200;
    } else {
      var graphWidth = window.innerWidth/1280*550;
      var graphHeight = window.innerHeight/800*200;
      if (graphWidth > 550) {
        graphWidth = 550;
      }
      if (graphHeight > 200) {
        graphHeight = 200;
      }
    }

    var graph = new Rickshaw.Graph({
      element: document.querySelector("#graph-"+pairDatum.pairId),
      renderer: 'multi',
      unstack: true,
      series: seriesData,
      width: graphWidth,
      height: graphHeight,
      min: 0,
      max: 90
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

  prepareGraphSeries: function(unformattedData, level, renderer, start, utc, maxPoints) {

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
        formattedDatum = {'x':currentTimeSeconds,'y':unformattedData[i]};
        data.push(formattedDatum);
        currentTimeSeconds = currentTimeSeconds + 5*60000/1000;
      }

    }

    var name = level
    var seriesElement = {};
    seriesElement.data = data;

    // Set Name
    nameMap = {
      'max':'Maximum Predicted Speed',
      '90':'90th Percentile Predicted Speed',
      '75':'75th Percentile Predicted Speed',
      '50':'Predicted Speed',
      '25':'25th Percentile Predicted Speed',
      '10':'10th Percentile Predicted Speed',
      'min':'Minimum Predicted Speed'
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
      'Minimum Predicted Speed':'rgb(255,255,255)',
      '10th Percentile Predicted Speed':outer,
      '25th Percentile Predicted Speed':mid,
      'Predicted Speed':inner,
      '75th Percentile Predicted Speed':inner,
      '90th Percentile Predicted Speed':mid,
      'Maximum Predicted Speed':outer,
      'Predictions ':'rgb(243,154,29)',
      'Earlier Today': 'rgb(135,135,135)',
      'Past Thanksgiving': 'rgb(115,115,115)',
      'Now':'rgb(0,0,255)'
    }
    seriesElement.color = levels[seriesElement.name]

    seriesElement.renderer = renderer
    return seriesElement;
  },

  getDayOfWeek: function() {
    now = new Date();
    return now.getDay();
  },

  getMiseryIndex: function(current, pairIds) {
    var denominator = 0;
    var numerator = 0;
    var speedSummation = 0;
    var freeflowSummation = 0;
    var count = 0;
    var impactedSegments = [];

    for (var pairId in current.pairData) {
      pair = current.pairData[pairId];

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
      'miseryIndex': miseryIndex.toFixed(1),
      'speed': Math.round(speedSummation/count),
      'freeFlow': Math.round(freeflowSummation/count),
      'impactedSegments': impactedSegments
    }
  }
}

// Get Data and Initialize
var graphData = {};
var dowGetter = new Date();
var thanksGivingIndex = dowGetter.getDay();

var thanksGivingData = [
  {'2012': '20121118.json', '2013': '20131124.json' },
  {'2012': '20121119.json', '2013': '20131125.json' },
  {'2012': '20121120.json', '2013': '20131126.json' },
  {'2012': '20121121.json', '2013': '20131127.json' },
  {'2012': '20121122.json', '2013': '20131128.json' },
  {'2012': '20121123.json', '2013': '20131129.json' },
  {'2012': '20121124.json', '2013': '20131130.json' }];

$.when(
  $.getJSON("data/predictions/similar_dow.json")
  ,$.getJSON("data/today.json")
  ,$.getJSON("data/current.json")
  ,$.getJSON("thanksgiving/"+thanksGivingData[thanksGivingIndex][2012])
  ,$.getJSON("thanksgiving/"+thanksGivingData[thanksGivingIndex][2013])
).then( function (similarDowResults, todayResults, currentResults, thanksGiving2012Results, thanksGiving2013Results) {
  var pairDatums = {};
  var allGraphData = {};

  allGraphData.similar_dow = similarDowResults[0];
  allGraphData.today = todayResults[0];
  allGraphData.thanksgiving_2012 = thanksGiving2012Results[0];
  allGraphData.thanksgiving_2013 = thanksGiving2013Results[0];
  var current = currentResults[0];

  zones = {
    'north': {"northbound": [5587, 5574, 5572, 5511, 5556], "southbound": [5557, 5559, 5573, 5575, 5588] },
    'south': {"northbound": [10193, 10190, 10189, 10188, 10187/*, 14669*/, 5506], "southbound": [/*14670,*/ 10182, 10181, 10180, 10179, 10178, 5501]},
    'west': {"westbound": [10088, 10086, 10085, 10389, 10386, 10385, 10382, 10357, 10356], "eastbound": [10499, 10379, 10376, 10375, 10374, 10238, 10083, 10082] },
  }

  // Show speed and misery index
  for (zoneName in zones) {
    var directions = zones[zoneName]
    for (direction in directions) {
      var zoneGraphData = {};
      var zonePairIds = directions[direction];
      var regionalConditions = helper.getMiseryIndex(current, zonePairIds);
      var pairName = zoneName + '-' + direction;
      $('#detail-region-' + pairName + ' .average-region-speed').html(regionalConditions.speed);
      $('#detail-region-' + pairName + ' .misery-index').html(regionalConditions.miseryIndex);

      // Show the congestion ratio
      var congestionRatioText = helper.getCongestionRatioText(regionalConditions)
      $('#detail-region-' + pairName + ' .average-region-status').addClass('status-'+congestionRatioText);
      $('#detail-region-' + pairName + ' .average-region-status-text').html(congestionRatioText);

      // Coalesce Speeds
      var numeratorSpeed = 0;
      var numeratorTravelTime = 0;
      var denominator = 0;
      var distance;
      var zonePairDatum = {};
      var pairDatum;
      var travelTimes = 0;
      var counter = 0;
      for (pairId in current.pairData) {
        if (zonePairIds.indexOf(parseInt(pairId)) !== -1) {
          pairDatum = current.pairData[pairId];
          distance = pairDatum.travelTime/60*pairDatum.speed;
          numeratorSpeed += pairDatum.speed*distance;
          numeratorTravelTime += pairDatum.travelTime*distance;
          denominator += distance;
          counter++
        }
      }
      zonePairDatum.speed = numeratorSpeed/denominator;
      zonePairDatum.travelTime = numeratorTravelTime/denominator;
      zonePairDatum.pairId = pairName;

      // Coalesce similar_dow
      var numerator = {};
      var denominator = {};
      var pairDatum, distance, percentiles, travelTimes;
      for (pairId in allGraphData.similar_dow) {
        if (zonePairIds.indexOf(parseInt(pairId)) !== -1) {
          pairDatum = current.pairData[parseInt(pairId)];
          if (typeof pairDatum !== 'undefined') {
            distance = pairDatum.travelTime/60*pairDatum.speed;
            percentiles = allGraphData.similar_dow[parseInt(pairId)];
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
      similarDow[pairName] = {};
      for (percentile in numerator) {
        currentNumerator = numerator[percentile];
        currentDenominator = denominator[percentile];
        if (typeof similarDow[percentile] === 'undefined') {
          similarDow[pairName][percentile] = []
        }
        for (var i=0; i<currentNumerator.length; i++) {
          similarDow[pairName][percentile][i] = currentNumerator[i]/currentDenominator[i];
        }
      }
      similarDow.Start = allGraphData.similar_dow.Start;
      zoneGraphData["similar_dow"] = similarDow;

      // Coalesce today, thanksgiving 2012, and thanksgiving 2013
      var simpleItems = ['today', 'thanksgiving_2012', 'thanksgiving_2013']
      for (var j=0; j<simpleItems.length; j++) {
        var simpleItem = simpleItems[j]
        var numerator = [];
        var denominator = [];
        var pairDatum, distance, percentiles, travelTimes;
        for (pairId in allGraphData[simpleItem]) {
          if (zonePairIds.indexOf(parseInt(pairId)) !== -1) {
            pairDatum = current.pairData[pairId];
            if (typeof pairDatum !== 'undefined') {
              distance = pairDatum.travelTime/60*pairDatum.speed;
              travelTimes = allGraphData[simpleItem][pairId];
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
        }
        var tempSimpleItem = {};
        tempSimpleItem[pairName] = []
        for (var i=0; i<numerator.length; i++) {
          tempSimpleItem[pairName][i] = numerator[i]/denominator[i];
        }
        tempSimpleItem.Start = allGraphData[simpleItem].Start;
        zoneGraphData[simpleItem] = tempSimpleItem;
      }


      pairDatums[pairName] = zonePairDatum;
      graphData[pairName] = zoneGraphData;
      renderers.renderGraph(zonePairDatum, zoneGraphData, 'today');
      events.setZoneGraphControlEvents(zonePairDatum);
    }
  }


  var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  dow = helper.getDayOfWeek();
  $('.dow_insert').html(days[dow]);


  $('.sections').show()
});
