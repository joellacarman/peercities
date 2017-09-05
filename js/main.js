var margin = {top: 10, left: 10, bottom: 10, right: 10},
  width = parseInt(d3.select("#map-container").style("width")),
  width = width - margin.left - margin.right,
  mapRatio = .5,
  height = width * mapRatio;

var usMap = d3.select("#map-container").append("svg")
              .style("height", height + "px")
              .style("width", width + "px");

var projection = d3.geoAlbersUsa()
                    .scale(width)
                    .translate([width/2, height/2]);
var path = d3.geoPath(projection);
              //purple, yellow, lt blue, green
var colors = ["#904799", "#ECAA20", "#71A0D5", "#4FC0B0"];

var strokeColor = "#ABC6E7";
var peerStroke = "#1E4586";

var initialR = 0.00278,
    largeR = 0.007,
    hiliteR = 0.004;

//dataset specific variables
var PLACE_NAME = "city",
    PEER_GROUP = "cluster",
    GEOID = "census_code",
    DEFAULT_GEO = "362077001";

var NESTED_PEER_GROUPS,
    CITY_DATA,
    TITLES,
    SELECTED_GEOID = DEFAULT_GEO;

d3.queue()
  .defer(d3.csv, "data/city-data.csv")
  .defer(d3.csv, "data/city-titles.csv")
  .defer(d3.json, "data/us-states.json")
  .await(dataReady);

function dataReady(error, data, dataTitles, us){
  if (error) throw error;

  CITY_DATA = d3.nest()
                .key(function(d){ return d[GEOID]; })
                .map(data);

  TITLES = d3.nest()
              .key(function(d){ return d.variable; })
              .entries(dataTitles);

  NESTED_PEER_GROUPS = d3.nest()
              .key(function(d){ return d[PEER_GROUP]; })
              //could sort here by some other value in the "leaves"
              .sortValues(function(a,b) { return a[PLACE_NAME] > b[PLACE_NAME] } )
              .map(data);



  makeDropDown(data);
  drawMap(us);
  drawCircles(data);
  showSelectionOnMap();
}

function makeDropDown(data){
  var menuData = data.slice();

  menuData.sort(function(a, b){
    return a[PLACE_NAME].localeCompare(b[PLACE_NAME]);
  })

  var select = d3.select("select").on("change", menuSelected)

  var options = select.selectAll("option")
                      .data(menuData)
                      .enter()
                      .append("option")
                      .text(function(d){ return d[PLACE_NAME] })
                      .attr("value", function(d){ return d[GEOID] })
                      .attr("id", function(d){ return "m" + d[GEOID] })
                      .property("selected", function(d){ return d[GEOID] === DEFAULT_GEO; })
}

function menuSelected(d){
  SELECTED_GEOID = this.value;
  showSelectionOnMap();
}

function drawMap(us){
  usMap.style("width", width).style("height", height);

  usMap.selectAll("path")
    .data(us.features)
    .enter().append("path")
    .attr("d", path)
    .attr("fill", "#FFFFFF")
    .attr("stroke", "#B4B4B4")
    .attr("stroke-width", 0.5)
    .attr("class", "state")
}

function drawCircles(data){

  var cities = usMap.selectAll("circle")
    .data(data)
    .enter()
    .append("g")
    .attr("transform", function(d) {
      return "translate("+ projection([d.lon, d.lat])+')';
    })
    .attr("class", "city")
    .attr("id", function(d){ return "n" + d[GEOID]; });

  cities.append("circle")
    .attr("r", width * initialR)
    .style("fill", "#FFFFFF")
    .style("stroke", strokeColor)      //have added letter before ID bc all numbers messes up D3
    .attr("id", function(d){ return "c" + d[GEOID]; })
    .on("click", circleSelected);
}


function circleSelected(d,i){
  SELECTED_GEOID = d[GEOID];

  //set the menu selection to match the circle selection - TODO, could use d3.dispatch?
  var menuOptions = d3.select("select").node().options;
  for (var i = 0; i < menuOptions.length; i++){
    if ( menuOptions[i].value === SELECTED_GEOID ){
      menuOptions.selectedIndex = i;
    }
  }
  showSelectionOnMap();
}

function showSelectionOnMap(){
  usMap.selectAll("circle")
    .transition()
      .attr("r", width * initialR)
      .style("fill", "#FFFFFF")
      .style("stroke", function(d){ if ( d[PEER_GROUP] ===
                                        CITY_DATA["$" + SELECTED_GEOID][0][PEER_GROUP] ){
                                         return peerStroke;
                                       } else { return strokeColor; } });

  usMap.selectAll(".city-name-label")
    .remove();

  d3.select("#c" + SELECTED_GEOID).transition()
      .style("fill", "#1E4586")
      .attr("r", width * largeR)
    .transition()
      .attr("r", width * hiliteR)
      .style("stroke", "#1E4586")

  d3.select("#n" + SELECTED_GEOID).append("text")
    .text(function(d){ return d[PLACE_NAME] })
    .attr("class", "city-name-label")
    .attr("transform", "translate( 10, 5)");

  makeTable(CITY_DATA["$" + SELECTED_GEOID][0][PEER_GROUP]);
}

function makeTable(peerGroup){
  d3.select("table").remove();

  var startCol = 0,
      endCol = 5;

  var columns = TITLES.slice(startCol,endCol).map(function(obj){
                                                return {name: obj.values[0].name,
                                                  variable: obj.values[0].variable}
                                              });

  var selectedCityName;
  var peersForChart = NESTED_PEER_GROUPS["$" + peerGroup].map(function(peer){
                                                  if ( peer[GEOID] === SELECTED_GEOID ){
                                                      selectedCityName = peer[PLACE_NAME];
                                                  }
                                                  return d3.entries(peer).slice(startCol,endCol)
                                              });

//move selected city to front of array and make key value pairs to get data-title
  for (var i = 0; i < peersForChart.length; i++){
    for ( var j = 0; j < peersForChart[i].length; j++){
      peersForChart[i][j].key = columns[j].name;
    }
    if ( peersForChart[i][0].value === selectedCityName ){
      peersForChart.unshift(peersForChart[i])
      peersForChart.splice(i +1, 1)
    }
  }

  var table = d3.select("body").append("table"),
        thead = table.append("thead"),
        tbody = table.append("tbody");

  thead.append("tr")
      .selectAll("th")
      .data(columns)
      .enter()
      .append("th")
      .text(function(d) { return d.name; });

  var rows = tbody.selectAll("tr")
      .data(peersForChart)
      .enter()
      .append("tr");

  var cells = rows.selectAll("td")
      .data(function(d){ return d; })
      .enter()
      .append("td")
      .text(function(d){ return d.value; })
      .attr("data-title", function(d){ return d.key });

  pymChild.sendHeight();

}

//responsive map, thanks Chris: http://eyeseast.github.io/visible-data/2013/08/26/responsive-d3/
d3.select(window).on('resize', resize);

function resize(){
    width = parseInt(d3.select("#map-container").style("width"));
    width = width - margin.left - margin.right;
    height = width * mapRatio;

    // update projection
    projection
        .translate([width / 2, height / 2])
        .scale(width);

    // resize the map container
    usMap
        .style("width", width)
        .style("height", height);

    // resize the map
    usMap.selectAll(".state").attr("d", path);
    usMap.selectAll(".city").attr("transform", function(d) {
      return "translate("+ projection([d.lon, d.lat])+")";
    })

}










