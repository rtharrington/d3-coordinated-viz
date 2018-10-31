


(function() {

    // Pseudo-global variables
    var attrArray = ["AveRetailPrice_CentsPerKWH", "Electricty", "NaturalGas", "Internet_60Mbps", "TotalCost"];

    var attArrayTranslate = {
        AveRetailPrice_CentsPerKWH: "Ave Retail Price ($Cents/kWh)",
        Electricty: "Electricty Cost per Month",
        NaturalGas: "Natural Gas Cost per Month",
        Internet_60Mbps: "Internet (60Mbps) Cost per Month",
        TotalCost: "Average Utility Cost per Month"
    };


    var pageHeight = 460;

    var expressedAttr = attrArray[0]; // initial attribute for array

    // chart dimensions with responsive width & height
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = pageHeight,
        leftPadding = 25,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    // scale to size bars proportional to window frame
    var yScale = d3.scaleLinear()
        .range([chartHeight-7, 0])    // all possible OUTPUT PIXELS
        .domain([0, 27]); // all possible INPUT VALUES

    // Execute script when window opens
    window.onload = setMap();

    // Sets up choropleth map
    function setMap() {
        // var width = 850, height = 460;  // Replaced original map dimensions with using HTML innerWidth attribute
        var width = window.innerWidth * 0.5,
            height = pageHeight-10;

        ///// Zoom behavior found here: https://coderwall.com/p/psogia/simplest-way-to-add-zoom-pan-on-d3-js
        // define zoom behavior
        var zoom = d3.zoom()
            .scaleExtent([0.2, 10])
            .on("zoom", zoomFunction);

        // Zoom Funtion Event Listener
        function zoomFunction(){
            var transformZoom = d3.zoomTransform(this);
            var zoomMap = d3.select("#mapg")
                    .attr("transform", "translate(" + transformZoom.x + "," + transformZoom.y + ") scale(" + transformZoom.k + ")");

        };

        // Create svg graphic as map container; setting width & height within svg graphic as attributes
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height)
            .attr("id", "mapsvg")
            .append("g")
            .attr("id", "mapg")
            .call(zoom);

        // Create Albers USA equal area conic projection centered on US
        var projection = d3.geoAlbers()
         .center([0, 43.5])
         .rotate([98, 4, 0])
         .parallels([45.00, 45.5])
         .scale(800)
         .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        d3.queue()
            .defer(d3.csv, "data/StateUtilites.csv")      // csv with attributes
            .defer(d3.json, "data/usa.topojson")   // topojson of states
            .await(callback);

        // function to load data & report errors during loading
        function callback(error, csvData, states) {

            // Sets graticule lines with blue ocean
            setGraticule(map, path);

            // Translating topojson to geojson
            var stateBoundaries = topojson.feature(states, states.objects.states).features;

            // Add state geojson to map
            var states = map.append("path")
                .datum(stateBoundaries)
                .attr("class", "state")
                .attr("d", path);

            // Join csv data to geojson states (as enumeration units)
            stateBoundaries = joinData(stateBoundaries, csvData);

            // Generates a color scale based on full range of all values in csvData
            var colorScale = makeColorScale(csvData);

            // Add states geojson as enumeration units
            setEnumerationUnits(stateBoundaries, map, path, colorScale);

            // Build chart container of graphs
            setChart(csvData, colorScale);

            // Create d3-based dropdown in DOM
            createDropDown(csvData);
        };
    }; // end setMap() function

    function setGraticule(map, path) {
        var graticule = d3.geoGraticule()
            .step([5, 5]);  // places graticule line every 5 degrees of lat/long

        var gratBackground = map.append("path")
            .datum(graticule.outline())         // binds graticule background
            .attr("class", "gratBackground")    // assigns class for css styling
            .attr("d", path)                    // projects graticule and attaches d to path of svg

        // select all graticule lines to append to each element
        var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
            .data(graticule.lines())    // bind graticule lines to each element to be created
            .enter()                    // create an element for each datum
            .append("path")             // append each element to the svg as a path element
            .attr("class", "gratLines") // assign class for styling
            .attr("d", path);           // project graticule lines
    };

    function joinData(stateBoundaries, csvData) {
        // Looping through array to join to geojson state
        for (var i=0; i < csvData.length; i++) {
            var csvStates = csvData[i];  // current region's data for variable i
            var csvKey = csvStates.abbrev; // csv's primary key to join to geojson file
            // then for each csv value, loop through geojson states to find matching state
            for (var a = 0; a < stateBoundaries.length; a++) {
                var geojsonProperties = stateBoundaries[a].properties;  // getting geojson stateBoundaries properties
                var geojsonKey = geojsonProperties.abbrev;            // matching geojson key

                // if geojsonKey matches csvKey, set csv properties to geojson object (temp. join)
                if (geojsonKey == csvKey) {
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvStates[attr]);  // gets csv attribute value parsed as a floating point val
                        geojsonProperties[attr] = val;           // with csv val, find matching val to geojson data
                    });
                };
            };
        };

        return stateBoundaries;
    };

    function setEnumerationUnits(stateBoundaries, map, path, colorScale) {
        // Can reference topojson files of states with attributes "name" or "abbrev"
        var states = map.selectAll(".states")
            .data(stateBoundaries)
            .enter()
            .append("path")
            .attr("class", function(d) {
                return "states " + d.properties.abbrev;   // used for highlight
                  })
            .attr("d", path) // path variable is the svg path
            .style("fill", function(d) {
                return getChoroplethColor(d.properties, colorScale);
            })
            // need to pass the anonymous function to access only the d properties; otherwise, we'd be getting all the data
            .on("mouseover", function(d) {
                highlight(d.properties);
            })
            .on("mouseout", function(d) {
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);

        // Add desc element for each path element in states object to change stroke
        var desc = states.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5"}');

      var sources = d3.select("body")
      .append("div")
      .attr("class","source")
      .html("<span>Sources:<br>US Energy Inforation Administration<br>https://www.move.org/which-states-pay-most-utilities/</span>")
        //console.log(error);
        //console.log(csvData);
//        console.log(stateBoundaries);
    };

    function getChoroplethColor(featureProperties, colorScale){
        // convert val to float for expressedAttr global variable
        var val = parseFloat(featureProperties[expressedAttr]);
        // if val is NaN, then return gray color
        if (typeof val == 'number' && !isNaN(val)) {
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };

    
    function makeColorScale(data) {



       var colorClasses = [
           "#E7F3EF",
           "#79BEA8",
           "#448D76",
           "#23483C",
           "#093426"
       ];

        // d3's color generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        // Builds array of all values from "expressedAttr" global array
        // USE THIS TO CREATE SEPARATE RANGES FOR EACH VARIABLE
        var domainArray = [];
        for (var i=0; i<data.length; i++) {
            var val = parseFloat(data[i][expressedAttr]);
            domainArray.push(val);
        };

        // Cluster data using ckmeans alogorithm for natural breaks of 5 classes
        var clusters = ss.ckmeans(domainArray, 5);

        // Reset domain array to cluster mins to get the min. value from each array. Min values serve as break points
        domainArray = clusters.map(function(d) {
            return d3.min(d);
        });

        // remove 1st value from domain array to create class breakpoints
        domainArray.shift();

        // Assign all values as scale domain for last 4 clusters of values
        colorScale.domain(domainArray);
        return colorScale;
    };

    function setChart(csvData, colorScale) {
        // svg element to hold bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        // create background rectangle for chart fill
        var chartBackground = d3.select("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        // set chart bars for each state. Sets widge of the (page width)/# data records
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")

            // sort graph bars in ascending order using d3's sort ()method; comparator js function to compare each value to the next
            .sort(function(a, b) {
                return b[expressedAttr] - a[expressedAttr];
            })
            .attr("class", function(d){
                return "bar " + d.abbrev;   // used for highlight function
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            // only need to use "highlight" function without entire data properties since we already have the "d.abbrev" being returned
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);

        // Add style descriptor to each rectangle
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

        // Bar title
        var chartTitle = chart.append("text")
            .attr("x", 250)  // append 40 pixels to the right
            .attr("y", 40)  // append 40 pixels down
            .attr("class", "chartTitle")
            .text("State " + attArrayTranslate[expressedAttr]);

        // Vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);


        // place axis; the svg "g" group attribute
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        // frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        // set bar positions, heights, & bar colors
        updateChart(bars, csvData.length, colorScale);
    };

    // Adds dropdown menu to DOM
    function createDropDown(csvData) {
        // add "select" element to body & add dropdown class. Uses event listener for changing the dropdown
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function() {
                changeAttribute(this.value, csvData)
            });

        // initial options to title class, to allow use to turn on title??
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")       // disabled to prevent users from selecting the name of "Select Attribute" since this is only the default option
            .text("Select Attribute");

        // add attribute name options for the attribute array
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d) { return d; })
            .text(function(d){
                // add in conditional for renaming attributes
                return attArrayTranslate[d];
            });

    };

    // Takes data & changes attribute based on user interaction within dropdown
    function changeAttribute(attribute, csvData) {
        // change expressed attribute from data array attrArray; replaces global variables with whay user selects in dropdown
        expressedAttr = attribute;

        // recreate color scale for new attribute
        var newColorScale = makeColorScale(csvData);

        // recolor enumeration units
        var newStates = d3.selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function(d) {
                return getChoroplethColor(d.properties, newColorScale)
            });

        // changing axis based on changed data value ranges
        var dataMax = d3.max(csvData, function(d) {
            return + parseFloat(d[expressedAttr]);
        });

        // reset yScale to new range of data users selected
        yScale = d3.scaleLinear()
            .range([chartHeight-7, 0])
            .domain([0, dataMax]);
//        console.log("yScale Updated dataMax: ", dataMax);

        // re-sort, re-size, & recolor bars for new attributes
        var bars = d3.selectAll(".bar")
            //re-sort
            .sort(function(a, b){
                return b[expressedAttr] - a[expressedAttr];
            })
            .transition()
            .delay(function(d, i) {
                return i * 20;
            })
            .duration(1000)
            .ease(d3.easeBounceOut);

        updateChart(bars, csvData.length, newColorScale);

    };

    // Sets bar positions, heights, & colors
    function updateChart(bars, n, colorScale) {
        // position bars
        bars.attr("x", function(d, i) {
            return i * (chartInnerWidth / n) + leftPadding;
        })

        /*size/resize bars based on chart heights
        Needed if-else to catch negative values from chart calculation*/
        .attr("height", function(d){
            var outHeight = (chartHeight-9) -  yScale(d[expressedAttr]);
            if (outHeight < 0) {
                return 0;
            } else {
                return outHeight;
            }})
        .attr("y", function(d) {
            var outY = yScale(d[expressedAttr]) +5;
            if (outY < 0) {
                return 0;
            } else {
                return outY;
            }})
        .style("fill", function(d) {
            return getChoroplethColor(d, colorScale);
        });



        var chartTitle = d3.select(".chartTitle")
            .text(attArrayTranslate[expressedAttr]);

        // Bob Cowlings' fix to adjust the yAxis
        var yAxis = d3.axisLeft()
            .scale(yScale)
            //Format the charts axis labels
            .tickFormat(function (d) {
                if ((d / 1000) >= 1) {
                    d = d / 1000 + "K";
                }
                return d;
            });

        //update the charts axis
        var update_yAxis = d3.selectAll("g.axis")
        .call(yAxis);
    };

    // Highlights enumeration units & bars on mouseover
    function highlight(dataProperties) {
        // change stroke
        var selected = d3.selectAll("." + dataProperties.abbrev)
            .style("stroke", "white")
            .style("stroke-width", "3");

        // add dynamic label on mouseover
        setLabel(dataProperties);
    };

    // Dehighlights enumeration units & bars on mouseout. Select path's style & replaces existing style with highlighted style that was appended to path element with highlight() function
    function dehighlight(dataProperties) {
        var selected = d3.selectAll("." + dataProperties.abbrev)
            .style("stroke", function() {
                return getStyle(this, "stroke");
            })
            .style("stroke-width", function() {
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName) {
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);
            return styleObject[styleName];

        };
        // remove dynamic label created through function setLabel() on mouseout
        d3.select(".infolabel")
            .remove();
    };

    // Creates dynamic labels that move with the curor
    function setLabel(dataProperties) {
        // only puts 2 decimal places after value for attributes other than number of utilities/state
        if (expressedAttr != "") {
            var val =
                parseFloat(Math.round(dataProperties[expressedAttr] * 100) / 100).toFixed(2);
        } else {
            val = dataProperties[expressedAttr];
        }

        // label content for specific attribute, accessed through a dictionary
        var labelAttribute = "<h1>" + val +
            "</h1><b>" + attArrayTranslate[expressedAttr] + "</b>";

        // info label div added to DOM
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", dataProperties.abbrev + "_label")
            .html("$"+labelAttribute);

        // append label to infolabel
        var stateName = infolabel.append("div")
            .attr("class", "stateName")
            .html(dataProperties.abbrev);
    };

    // Moves infolabel with mouse move
    function moveLabel() {
        // get width of label
        var labelWidth = d3.select(".infolabel")
            .node()     // returns DOM node
            .getBoundingClientRect()
            .width;

        // get mouse coordinates to set label to those
        var x1 = d3.event.clientX + 10,
            y2 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y1 = d3.event.clientY - 25;

        // horizontal label coordinate, testing for label overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;

        // vertical label coordinate, testing for label overflow
        var y = d3.event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");


    };

})();
