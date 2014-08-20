function InterestDashboard() {
  /* Initing the pie chart */
  this._pieChart = nv.models.pieChart()
      .showLegend(false)
      .x(function(d) { return d.label })
      .y(function(d) { return d.value })
      .showLabels(false);

  nv.addGraph(function() {
    return this._pieChart;
  });

  /* Initing the area graph */
  this._areaGraph = nv.models.stackedAreaChart()
                .margin({right: 100})
                .x(function(d) { return d[0] })
                .y(function(d) { return d[1] })
                .useInteractiveGuideline(true)
                .showLegend(false)
                .showYAxis(false)
                .showXAxis(false)
                .showControls(false)
                .transitionDuration(300);

  this._areaGraph.xAxis
    .tickFormat((d) => { return d3.time.format('%x')( new Date(d)); });

  this._areaGraph.yAxis
    .tickFormat((d) => { return d; });

  nv.addGraph(() => {
    return this._areaGraph;
  });
}

InterestDashboard.prototype = {
  _getMaxDate: function(days) {
    let max = 0;
    for (let day in days) {
      if (Number(day) > max) {
        max = Number(day);
      }
    }
    return d3.time.format('%A, %B %e, %Y')(new Date(days[max].x));
  },

  _computeTimeString: function(timestamp) {
    let AMorPM = "am";
    let date = new Date(timestamp);
    let hours = date.getHours();
    let minutes = date.getMinutes() < 10 ? ("0" + date.getMinutes()) : date.getMinutes();
    if (hours > 12) {
      hours -= 12;
      AMorPM = "pm";
    }
    return hours + ":" + minutes + " " + AMorPM;
  },

  _addTableRows: function(data, table) {
    for (let i = 0; i < data.tableData.length; i++) {
      let categoryObj = data.tableData[i];
      table.row.add([
        "<div class='rank-container'>" + (i + 1) + "</div>",
        "<div class='category-name'>" + categoryObj.name + "</div>" +
        "<div class='category-count'> (" + categoryObj.visitCount + ")</div>",
        this._getMaxDate(categoryObj.days),
        null
      ]).draw();

      // Add classes
      table.column(-1).nodes().to$().addClass('details-control');
    }
    table.columns.adjust();
  },

  _addTopSites: function(data, $scope) {
    $scope.list = data.sortedDomains.slice(0, 10);
  },

  _addStats: function(data, $scope) {
    $scope.totalVisits = data.totalVisits;
    $scope.totalViews = data.totalViews;
    $scope.weeklyAvg = data.totalWeeklyAvg.toFixed(0);
    $scope.dailyAvg = data.totalDailyAvg.toFixed(0);
  },

  _formatSubtable: function(historyVisits) {
    let table = '<div id="subtable"><table cellpadding="5" cellspacing="0" border="0">';
    for (let visitIndex = 0; visitIndex < historyVisits.length; visitIndex++) {
      let visit = historyVisits[visitIndex];
      let time = this._computeTimeString(visit.timestamp);
      let lastVisitString = visitIndex == (historyVisits.length - 1) ? 'lastVisit' : '';

      table += '<tr>' +
        '<td class="time historyVisit">' + time + '</td>' +
        '<td><div class="timelineCircle ' + lastVisitString + '"></div></td>' +
        '<td><img class="favicon historyVisitFavicon" src="' + visit.favicon + '"></img></td>' +
        '<td><div class="domain">' + visit.url + '</div>' +
        '<div class="visitTitle historyVisit"> - ' + visit.title + '</div></td>'
      '</tr>';
    }
    table += '</table></div>';
    return table;
  },

  _handleRowExpand: function(data, table) {
    // Add event listener for opening and closing details
    let self = this;
    $('#test tbody').on('click', 'td.details-control', function() {
      let tr = $(this).closest('tr');
      let row = table.row(tr);

      if (row.child.isShown()) {
        // This row is already open - close it
        row.child.hide();
        tr.removeClass('shown');
      } else {
        let parser = new DOMParser();
        let node = parser.parseFromString(row.data()[1], "text/html");
        let category = node.getElementsByClassName('category-name')[0].innerHTML;

        // Open this row
        row.child(self._formatSubtable(data.historyVisits[category])).show();
        tr.addClass('shown');
      }
    });
  },

  _renderPieGraph: function(data) {
    d3.select("#interestPie")
      .attr("class", "pie-graph-margin-fix")
      .datum(data.pieData)
      .transition().duration(350)
      .call(this._pieChart);

    d3.select("#interestPie")
      .append("circle")
      .attr("cx", 195)
      .attr("cy", 200)
      .attr("r", 77)
      .style("fill", "white")

    let tableLength = data.tableData.length;
    d3.select("#interestPie")
      .append("text")
      .attr("id", "interest-count")
      .attr("x", 170)
      .attr("y", 195)
      .text( function (d) { return tableLength > 9 ? tableLength : "0" + tableLength; });

    d3.select("#interestPie")
      .append("text")
      .attr("class", "title-font")
      .attr("x", 145)
      .attr("y", 223)
      .text( function (d) { return "Interests"; });
  },

  graph: function(data, table, $scope) {
    d3.select('#interestPie').selectAll("*").remove();
    d3.select('#areaGraph').selectAll("*").remove();
    table.clear();

    $scope.graphHeader = "Total usage - all categories (past 30 days)";
    this._renderPieGraph(data, data.tableData.length);

    $('div.dataTables_scrollBody').scroll(function(e) {
      let scrollPosition = $('div.dataTables_scrollBody').scrollTop();
      let shiftableBottom = document.getElementById("main-row-background");

      if (scrollPosition > 1) {
        shiftableBottom.classList.add('shift-animate');
      } else {
        shiftableBottom.classList.remove('shift-animate');
      }
    });

    let areaGraph = this._areaGraph;
    d3.selectAll('.nv-slice')
      .on('click', function(event) {
        $scope.$apply(function() {
          let categoryClicked = event.data.label;
          d3.select('#areaGraph').selectAll("*").remove();
          d3.select("#areaGraph")
            .attr("class", "area-graph-margin-fix")
            .datum(data.areaData[categoryClicked])
            .transition().duration(350)
            .call(areaGraph);

          $scope.totalVisits = data.categories[categoryClicked].visitCount;
          $scope.totalViews = data.categories[categoryClicked].viewCount;
          $scope.weeklyAvg = data.categories[categoryClicked].weeklyAvg.toFixed(0);
          $scope.dailyAvg = data.categories[categoryClicked].dailyAvg.toFixed(0);
        });
    });

    d3.select("#areaGraph")
      .attr("class", "area-graph-margin-fix")
      .datum(data.areaData.total)
      .transition().duration(350)
      .call(this._areaGraph);

    nv.utils.windowResize(this._areaGraph.update);
    nv.utils.windowResize(this._pieChart.update);

    this._addTopSites(data, $scope);
    this._addStats(data, $scope);
    this._addTableRows(data, table);
    this._handleRowExpand(data, table);
  }
}