"use strict";

let table, tour;

let DataService = function($rootScope) {
  this.rootScope = $rootScope;

  // relay messages from the addon to the page
  self.port.on("message", message => {
    this.rootScope.$apply(_ => {
      this.rootScope.$broadcast(message.content.topic, message.content.data);
    });
  });
}

DataService.prototype = {
  send: function _send(message, obj) {
    self.port.emit(message, obj);
  },
}

let aboutYou = angular.module("aboutYou", []);
aboutYou.service("dataService", DataService);

aboutYou.controller("vizCtrl", function($scope, dataService) {
  $scope._initialize = function () {
    $scope.daysLeft = null;
    $scope.daysLeftStart = null;
    $scope.percentProcessed = null;
    dataService.send("chart_data_request");
  }
  $scope.safeApply = function(fn) {
    let phase = this.$root.$$phase;
    if(phase == '$apply' || phase == '$digest') {
      if(fn && (typeof(fn) === 'function')) {
        fn();
      }
    } else {
      this.$apply(fn);
    }
  };
  $scope._copyToClipboard = function(message) {
    dataService.send("copy_to_clipboard", message);
  };
  $scope._requestSortedDomainsForCategory = function(categoryName) {
    dataService.send("category_topsites_request", {
      "categoryName": categoryName
    });
  };
  $scope._requestResetCategoryVisits = function(categoryName) {
    dataService.send("category_reset_request", {
      "categoryName": categoryName
    });
  };
  $scope._requestBookmarkChange = function(url, title) {
    dataService.send("bookmark_change_request", {
      "url": url,
      "title": title
    });
  };
  $scope._requestCategoryVisits = function (categoryName) {
    dataService.send("category_visit_request", {
      "categoryName": categoryName
    });
  };
  $scope.debugReportRequest = function() {
    dataService.send("debug_report_request");
  };
  $scope.updateProgressBar = function(progressNum, value) {
    if (progressNum != 3) {
      // When we are building cdb.json and meta.json, treat it as a first
      // run and show the tutorial prompt at the end of processing.
      $scope.firstRun = true;
    }

    $scope.processingBlurb = progressNum == 3 ? "Analyzing your history..." : "Pre-processing your history...";
    let val = value ? value : (100 - Math.round($scope.daysLeft / $scope.daysLeftStart * 100));

    // TODO: find out why sometimes the pipeline says it will process one
    // more day than it actually does. We shouldn't need to do this check.
    if (progressNum == 3 && $scope.daysLeft == 1) {
      val = 100;
    }

    let width = Math.round((progressNum - 1) * (100 / 3) + (val / 3));
    $scope.percentProcessed = width + "%";
    $("#progressBar").css("width", $scope.percentProcessed);
  };
  $scope.processHistory = function() {
    if ($scope.daysLeft) {
      return;
    }
    $("#visual-header-overlay").removeClass("fade-out");
    $("#main-overlay").removeClass("fade-out");
    dataService.send("history_process");
  };
  $scope._initialize();

  $scope.$on("json_update", function(event, data) {
    ChartManager.appendToGraph(data.type, data.data, table, $scope);
  });

  $scope.$on("append_visit_data", function(event, data) {
    ChartManager.appendCategoryVisitData(data.category, data.historyVisits, data.pageResponseSize, data.complete, $scope);
  });

  $scope.$on("cancel_append_visits", function(event, data) {
    ChartManager.cancelAppendVisits();
  });

  $scope.$on("chart_init", function(event, data) {
    ChartManager.graphAllFromScratch(data, table, $scope);
  });

  $scope.$on("debug_report", function(event, data) {
    ChartManager.sendDebugReport(data);
  });

  $scope.$on("populate_topsites", function(event, data) {
    ChartManager.populateTopsites(data.topsites, data.category);
  });

  $scope.$on("days_left", function(event, data) {
    if (!$scope.daysLeftStart) {
      $scope.daysLeftStart = data;
    }
    $scope.daysLeft = data;
    $scope.updateProgressBar(3);
  });

  $scope.$on("progress", function(event, data) {
    if (!$scope.daysLeftStart) {
      $scope.daysLeftStart = data.total;
    }
    $scope.daysLeft = data.total - data.progress;
    let progressNum = data.progressType == "historyProgress" ? 1 : 2;
    $scope.updateProgressBar(progressNum);

    // Handle visibility of progress bar.
    if ($scope.daysLeft == 0) {
      $scope.daysLeftStart = 0;

      if (data.progressType == "titleProgress") {
        setTimeout(() => {
          // After some time, no days_left event was triggered so let's get rid of the progress bar.
          if (!$scope.daysLeftStart) {
            $("#visual-header-overlay").addClass("fade-out");
            $("#main-overlay").addClass("fade-out");
          }
        }, 20000);
      }
    }
  });
});

self.port.on("style", function(file) {
  let link = document.createElement("link");
  link.setAttribute("href", file);
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  document.head.appendChild(link);
});

self.port.on("init", function() {
  table = $('#test').DataTable({
    "scrollY":        ($(window).height() - 145) + "px",
    "paging":         false,
    "searching":      false,
    "columns": [
      { "width": "80px" },
      { "width": "231px" },
      { "width": "22px" },
      { "width": "300px" },
      { "width": "40px", "orderable": false },
      { "width": "40px" },
      { "width": "40px" }
    ]
  });

  // Cog show and hide events for css updates.
  $('.cog').on('show.bs.dropdown', function () {
    $('.cog-btn').addClass('cog-clicked');
  });
  $('.cog').on('hide.bs.dropdown', function () {
    $('.cog-btn').removeClass('cog-clicked');
  });

  $("#cancelTutorial").on("click", function() {
    $("#tutorial-popover").removeClass("shownTutorialPanel");
  })
  $("#startTutorial").on("click", function() {
    $("#tutorial-popover").removeClass("shownTutorialPanel");
    if (!tour) {
      tour = new BrowserTour();
    }
    tour.startTour();
  })
});

function BrowserTour () {
  this.tourIsAnimating = false;
  this.tourIsVisible = true;

  this.$tour = $('#ui-tour').show();
  this.$mask = $('#ui-tour-mask').show();
  this.$tourTip = $('.tour-tip');
  this.$tourList = $('.ui-tour-list');
  this.$prevButton = $('button.prev');
  this.$nextButton = $('button.next');
  this.$closeButton = $('button.close');
  this.$progress = $('.progress-step');
  this.$progressStep = this.$progress.find('.step');
  this.$progressMeter = this.$progress.find('.progress');
  this.$tourControls = $('.ui-tour-controls');
  this.$cta = $('.cta');

  // bind UITour event listeners
  this.bindEvents();
}

/*
 * Bind custom events to handle calls to Mozilla.UITour
 * as well as regular event listeners for UI interaction
 */
BrowserTour.prototype.bindEvents = function () {
  // show tooltips on prev/next buttons
  this.$tour.on('transitionend', '.ui-tour-list li.current', this.onTourStep.bind(this));
  this.$closeButton.on('click', this.closeTour.bind(this));
  $('.cta button').on('click', () => {
    this.closeTour();
    window.open("https://www.mozilla.org/en-US/firefox/interest-dashboard/", '_blank');
  });
  $('button.step').on('click', this.onStepClick.bind(this));
  this.$tourControls.on('mouseenter focus', 'button.step', this.onStepHover.bind(this));
  this.$tourControls.on('mouseleave blur', 'button.step', this.offStepHover.bind(this));
};

/*
 * Tour navigation click handler
 */
BrowserTour.prototype.onStepClick = function (e) {
  e.preventDefault();
  let $button = $(e.target);
  let $current = this.$tourList.find('li.current');
  let step = $current.data('step');

  let trans = $button.hasClass('prev') ? 'prev' : 'next';
  this.goToTourStep(trans);
};

/*
 * Go directly to a specific step in the tour. This can be called from
 * within the web page to go directly to a specific tour step.
 */
 BrowserTour.prototype.goToStep = function (step) {
  let $current = $('.ui-tour-list .tour-step[data-step="' + step + '"]');
  $('.ui-tour-list .tour-step.current').removeClass('current visible');
  $('.ui-tour-list .tour-step').removeClass('prev-out next-out');
  $current.addClass('current visible');
  $('.ui-tour-list .tour-step:gt(' + step + ')').addClass('prev-out');
  $('.ui-tour-list .tour-step:lt(' + step + ')').addClass('next-out');
  this.$progressStep.html(step + "/4");
  this.$progressMeter.attr('aria-valuenow', step);
  this.updateControls();
};

/*
 * Transitions carousel animation to the next/prev step of the tour
 */
BrowserTour.prototype.goToTourStep = function (trans) {
  let $current = this.$tourList.find('li.current');
  let $prev;
  let $next;

  this.tourIsAnimating = true;
  this.$tourTip.removeClass('show-tip');
  // disable tour control buttons while animating
  $('.ui-tour-controls button').attr('disabled', 'disabled');
  // if we're moving back from the last step, hide green cta
  if ($current.is(':last-child')) {
    this.$cta.attr('disabled', 'disabled').fadeOut();
  }
  // animate in/out the correct tour panel
  if (trans === 'prev') {
    $current.removeClass('current next-out').addClass('prev-out');
    $prev = $current.prev().addClass('visible');
    // slight delay is needed when animating an element
    // after applying display: block;
    setTimeout(function () {
      $prev.addClass('current');
    }, 50);
  } else if (trans === 'next') {
    $current.removeClass('current prev-out').addClass('next-out');
    $next = $current.next().addClass('visible');
    setTimeout(function () {
      $next.addClass('current');
    }, 50);
  }
};

/*
 * Triggers the current step tour highlight / interaction
 * Called on `transitionend` event after carousel item animates
 */
BrowserTour.prototype.onTourStep = function (e) {
  if (e.originalEvent.propertyName === 'transform') {
    let $current = this.$tourList.find('li.current');
    let step = $current.data('step');
    let tipText;
    this.tourIsAnimating = false;

    this.$progressStep.html(step + "/4");
    this.$progressMeter.attr('aria-valuenow', step);
    this.$tourList.find('.tour-step').not('.current').removeClass('visible');
    // update the button states
    this.updateControls();
    // set focus on the header of current slide
    $current.find('h2').focus();
    if ($current.is(':last-child')) {
    // show green cta for the last step
    this.$cta.removeAttr('disabled').fadeIn();
    }
    // if user still has hover/focus over a button show the tooltip
    if ($('button.next:hover').length) {
      tipText = $current.data('tipNext');
      if (tipText) {
        this.$tourTip.html(tipText);
        this.$tourTip.addClass('show-tip');
      }
    } else if ($('button.prev:hover').length) {
      tipText = $current.data('tipPrev');
      if (tipText) {
        this.$tourTip.html(tipText);
        this.$tourTip.addClass('show-tip');
      }
    }
  }
};

/*
 * Updates the tour UI controls buttons to reflect the current step
 */
BrowserTour.prototype.updateControls = function () {
  let $current = this.$tourList.find('li.current');
  this.$closeButton.removeAttr('disabled', 'disabled');
  // update prev/next button states
  if ($current.is(':first-child')) {
    this.$prevButton.attr('disabled', 'disabled').addClass('faded');
    this.$nextButton.removeAttr('disabled').removeClass('faded');
  } else if ($current.is(':last-child')) {
    this.$nextButton.attr('disabled', 'disabled').addClass('faded');
    this.$prevButton.removeAttr('disabled').removeClass('faded');
  } else {
    $('.ui-tour-controls button').removeAttr('disabled').removeClass('faded');
  }
};

/*
 * Shows tooltips for next/prev steps when mouseenter or focus is applied to button
 */
BrowserTour.prototype.onStepHover = function (e) {
  e.preventDefault();
  let $button = $(e.target);
  let $current = this.$tourList.find('li.current');
  let tipText = $button.hasClass('prev') ? $current.data('tipPrev') : $current.data('tipNext');
  if (tipText) {
    this.$tourTip.html(tipText).addClass('show-tip');
  }
};

/*
 * Hide tooltips on mouseleave or blur
 */
 BrowserTour.prototype.offStepHover = function (e) {
  e.preventDefault();
  this.$tourTip.removeClass('show-tip');
};


/*
 * Starts the tour and animates the carousel up from bottom of viewport
 */
BrowserTour.prototype.startTour = function () {
  this.updateControls();
  let that = this;
  let $current = this.$tourList.find('li.current');
  let step = $current.data('step');
  this.$progressStep.html(step + "/4");
  // fade out the inner mask messaging that's shown the the page loads
  this.$tour.addClass('in').focus();
  this.$tour.attr('aria-expanded', true);
  this.tourIsVisible = true;
  this.tourHasStarted = true;
  setTimeout(this.onStartTour.bind(this), 600);
};

/*
 * When the tour finishes animating in from bottom, trigger the tour step
 */
 BrowserTour.prototype.onStartTour = function () {
  this.$mask.removeClass('out');
  let $current = this.$tourList.find('li.current');
  $current.find('h2').focus();
};

/*
 * Determines whether tour should be minimized or closed completely
 */
BrowserTour.prototype.closeTour = function () {
  let $current = this.$tourList.find('li.current');
  if (this.tourIsAnimating || !this.tourIsVisible) {
    return;
  }
  this.doCloseTour();
};

/*
 * Closes the tour completely
 * Triggered on last step or if user presses esc key
 */
BrowserTour.prototype.doCloseTour = function () {
  this.tourIsVisible = false;
  this.tourHasStarted = false;
  this.tourHasFinished = true;
  this.$cta.fadeOut('fast', $.proxy(function () {
    this.$tour.removeClass('in');
    this.$mask.addClass('out');
    setTimeout(this.onCloseTour.bind(this), 600);
  }, this));
};

BrowserTour.prototype.onCloseTour = function () {
  this.$mask.hide();
  // unbind ui-tour focus and keyboard event listeners
  this.$tour.off('.ui-tour');
  this.goToStep(1);
};

