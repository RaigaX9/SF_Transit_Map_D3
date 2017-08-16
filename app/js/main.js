'use strict';
$(document).ready(function() {
    // Setting up all of the variables first
    // var x = 0;
    // var circle1;
    var arr1 = [];
    var mapstuff = {};
    var width = 1500;
    var height = 1200;
    var rl;
    var searchpath;
    var posroute = {};
    var linesarr1 = [];
    var routesarr = [];
    var project;
    var path;

    // This will create an svg map
    var svg = d3.select('#nextbusmap').append('svg').attr('width', width).attr('height', height).append('g')
        .attr('id', '#displaysvg');

    // This will add the routes to the svg.
        function addRoutes(x, json) {

            var track = svg
                .append('g').attr('id', x)
                .selectAll("path")
                .data(json.features)
                .enter()
                .append('path')
                .attr('d', path);

            arr1.push(x);
        }

        // This will retrieve the buses' location from the nextbus XML from it's API using vehicleLocations
        function retrieveBusLocations(seconds) {
            var locations1 = [];
            var time = (seconds || 0);
            return rl
                .map(function (route) {
                    return $.get('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=sf-muni&r=' + route.id + '&t=' + time);
                }).reduce(function (chain, promise) {
                    return chain.then(function () {
                        return promise;
                    })
                        .then(function (data) {
                            posroute = retrieveLocationsData(data);
                            console.log(posroute);
                            locations1 = locations1.concat(posroute);
                        });
                })
                .then(function () {

                    return {
                        positions: locations1
                    };
                });
        }


        // This will create a projection of the SF map
        function performGeoProject(jsong) {
            var center = d3.geo.centroid(jsong);
            var offset = [width / 2, height / 2]
            var scale = 150;
            project = d3.geo.mercator().scale(scale).center(center)
                .translate(offset);

            // This will create routes for the projection.
            path = d3.geo.path().projection(project);

            // This will be used to determine the routes within the SF map based on the size and bounds of the map/
            var bounds = path.bounds(jsong);
            var width_scale = scale * width / (bounds[1][0] - bounds[0][0]);
            var height_scale = scale * height / (bounds[1][1] - bounds[0][1]);
            // Determining the scale of the map based on the given width and height current being used.
            if (height_scale < width_scale) {
                scale = height_scale
            }
            else {
                scale = width_scale;
            }
            offset = [width - (bounds[0][0] + bounds[1][0])/2, height - (bounds[0][1] + bounds[1][1]) / 2];

            // Creating new projection.
            project = d3.geo.mercator().center(center).scale(scale).translate(offset);
            path = path.projection(project);
        }

        // This will retrieve the locations for each of the buses based on the
        // loaded json datasets// based on their type and location.
        function retrieveLocationsData(data) {
            var coord = [];
            d3.select(data)
                .selectAll('vehicle')
                .each(function () {
                    var bus = d3.select(this);

                    coord.push({
                        type: 'Feature',
                        properties: {
                            id: bus.attr('id'),
                            route: bus.attr('routeTag')
                        },
                        geometry: {
                            type: 'Point',
                            coordinates: [bus.attr('lon'), +bus.attr('lat')]
                        }
                    });
                });

            return coord;
        }

        // This will create the buses as circles.
        function createBuses(jsong) {

            // Creating a circle
            var circle1 = svg.select('g.routes').selectAll('g.routeDots')
                .data(jsong.features, function (d) {
                    return d.properties.id;
                });

            // This will add the circles to the map.
            circle1.enter().append('g')
                .classed('routeDots', true);

            // This will show each time the circles are in new locations.
            circle1.transition('sin').duration(0)
                .attr('transform', function (d) {
                    var projPos = project(d.geometry.coordinates);
                    var circlepos = 'translate(' + projPos[0] + ',' + projPos[1] + ')';
                    return circlepos;
                });

            // Display the circles and shows different colors and their same sizes within each route.
            circle1.append('circle').attr('r', 4)
                .style('fill', function (d) {
                    return (searchpath[d.properties.route] && searchpath[d.properties.route].color);
                });

            return circle1;
        }

        // This will retrieve the routes' information
        function routeInfo(m) {
            var routes = [];
            d3.select(m)
                .selectAll('route')
                .each(function () {
                    var node = d3.select(this);
                    routes.push({id: node.attr('tag'), name: node.attr('title')});
                });
            return routes;
        }

        // This will retrieve the route config paths from nextbus API
        function retrievePathsConfig() {
            return $.get('http://webservices.nextbus.com/service/publicXMLFeed?command=routeConfig&a=sf-muni')
                .catch(function () {
                    console.log(arguments);
                });
        }

    // This will retrieve the route list from nextbus API.
        function retrieveRL() {
            return $.get('http://webservices.nextbus.com/service/publicXMLFeed?command=routeList&a=sf-muni')
                .catch(function () {
                    console.log(arguments);
                });
        }

    // This will create a tracker for each bus in different routes and paths.
        function createTracker() {
            var routesList = retrieveRL();
            var routesPaths = retrievePathsConfig();

            // Compile all of the route list and route paths to retrieve the buses' locations
            routesList
                .then(function (b) {
                    searchpath = {};
                    rl = routeInfo(b);
                    rl.forEach(function (route) {
                        searchpath[route.id] = route;
                    });

                    return routesPaths;
                })
                .then(function (data) {
                    placeRoutesOnMap(data);
                    return retrieveBusLocations();
                })
                .then(function (busInfo) {
                    // After it retrieve the current bus information, it will update the map with their new location.
                    busLocationUpdate(busInfo);
                });
        }

    // This will update the SF map for every 5000 miliseconds (5 seconds
        function busLocationUpdate(thebus) {

            createBuses({type: 'FeatureCollection', features: thebus.positions});

            // Timer for every time it updates the map.
            setTimeout(function () {
                retrieveBusLocations(thebus.avg)
                    .then(function (busInfo) {
                        busLocationUpdate(busInfo);
                    });
            }, 5000);
        }

    // This wil layout the routes in the map.
        function placeRoutesOnMap(routeinfo) {

            // Selects all the routes on the map.
            d3.select(routeinfo).selectAll('route').each(function () {
                var tag = d3.select(this).attr('tag');
                var color = d3.select(this).attr('color');
                searchpath[tag].color = color;

                // Properly place the routes at their locations.
                d3.select(this).selectAll('path').each(function () {
                    var latlong = [];
                    d3.select(this).selectAll('point').each(function () {
                        latlong.push([d3.select(this).attr('lon'), +d3.select(this).attr('lat'), 0]);
                    });

                    linesarr1.push({
                        type: 'Feature',
                        id: tag,
                        geometry: {
                            type: 'LineString',
                            coordinates: latlong
                        }
                    });
                });

                // Added routes information.
                routesarr.push({id: tag, color: color, paths: linesarr1});
            });

            var linespaths = routesarr.map(function (route) {
                return route.paths;
            }).reduce(function (features, paths) {

                return features.concat(paths);

            });

            svg.select('g.paths').selectAll('path').data(linespaths).enter().append('path').attr('d', path)
                .style('stroke', function (x) {
                    return searchpath[x.id].color;
                });


            return routesarr;
        }

    //This will get all of the json files from the 'sfmaps' folder and load them.
        mapstuff['arteries'] = $.getJSON('./sfmaps/arteries.json', function () {
            console.log("Success");
        });
        mapstuff['freeways'] = $.getJSON('./sfmaps/freeways.json', function () {
            console.log("Success");
        });
        mapstuff['neighborhoods'] = $.getJSON('./sfmaps/neighborhoods.json', function () {
            console.log("Success");
        });
        mapstuff['streets'] = $.getJSON('./sfmaps/streets.json', function () {
            console.log("Success");
        });

        /* There, we will use the load data jsons to the projection as well as
           going through each of them and adding to the svg. This will use the street data first to go over the
           projection bounds throughout SF. */
        mapstuff.streets.then(function (loadedjson) {
            // Create a project of SF based on the json datasets being used.
            performGeoProject(loadedjson);

            // Adding routes for neighborhoods, streets, arteries, and freeways on the map.
            mapstuff.neighborhoods
                .then(function (data) {
                    addRoutes('neighborhoods', data);
                }).then(function () {
                addRoutes('streets', loadedjson);
                return mapstuff.arteries;
            }).then(function (data) {
                addRoutes('arteries', data);
                return mapstuff.freeways;
            }).then(function (data) {
                addRoutes('freeways', data);
                svg.append('g').classed('routes', true);
                svg.append('g').classed('paths', true);
                createTracker();
            });

        });
});