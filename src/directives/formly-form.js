let angular = require('angular-fix');

module.exports = ngModule => {
  ngModule.directive('formlyForm', formlyForm);

  formlyForm.tests = ON_TEST ? require('./formly-form.test')(ngModule) : null;

  function formlyForm(formlyUsability) {
    var currentFormId = 1;
    return {
      restrict: 'E',
      template: require('./formly-form.html'),
      replace: true,
      transclude: true,
      scope: {
        fields: '=',
        model: '=?', // we'll do our own warning to help with migrations
        form: '=?'
      },
      controller: function($scope) {
        apiCheck();
        $scope.formId = `formly_${currentFormId++}`;

        angular.forEach($scope.fields, attachKey); // attaches a key based on the index if a key isn't specified
        angular.forEach($scope.fields, setupWatchers); // setup watchers for all fields

        // watch the model and evaluate watch expressions that depend on it.
        $scope.$watch('model', function onResultUpdate(newResult) {
          angular.forEach($scope.fields, function(field) {
            /*jshint -W030 */
            field.runExpressions && field.runExpressions(newResult);
          });
        }, true);

        function attachKey(field, index) {
          field.key = field.key || index || 0;
        }

        function setupWatchers(field, index) {
          if (!angular.isDefined(field.watcher)) {
            return;
          }
          var watchers = field.watcher;
          if (!angular.isArray(watchers)) {
            watchers = [watchers];
          }
          angular.forEach(watchers, function(watcher) {
            if (!angular.isDefined(watcher.listener)) {
              throw formlyUsability.getFieldError(
                'all-field-watchers-must-have-a-listener',
                'All field watchers must have a listener', field
              );
            }
            var watchExpression = getWatchExpression(watcher, field, index);
            var watchListener = getWatchListener(watcher, field, index);

            var type = watcher.type || '$watch';
            watcher.stopWatching = $scope[type](watchExpression, watchListener, watcher.watchDeep);
          });
        }

        function getWatchExpression(watcher, field, index) {
          var watchExpression = watcher.expression || `model['${field.key}']`;
          if (angular.isFunction(watchExpression)) {
            // wrap the field's watch expression so we can call it with the field as the first arg
            // and the stop function as the last arg as a helper
            var originalExpression = watchExpression;
            watchExpression = function formlyWatchExpression() {
              var args = modifyArgs(watcher, index, ...arguments);
              return originalExpression(...args);
            };
            watchExpression.displayName = `Formly Watch Expression for field for ${field.key}`;
          }
          return watchExpression;
        }

        function getWatchListener(watcher, field, index) {
          var watchListener = watcher.listener;
          if (angular.isFunction(watchListener)) {
            // wrap the field's watch listener so we can call it with the field as the first arg
            // and the stop function as the last arg as a helper
            var originalListener = watchListener;
            watchListener = function formlyWatchListener() {
              var args = modifyArgs(watcher, index, ...arguments);
              return originalListener(...args);
            };
            watchListener.displayName = `Formly Watch Listener for field for ${field.key}`;
          }
          return watchListener;
        }

        function modifyArgs(watcher, index, ...originalArgs) {
          return [$scope.fields[index], ...originalArgs, watcher.stopWatching];
        }

        function apiCheck() {
          // check that only allowed properties are provided
          var allowedProperties = [
            'type', 'template', 'templateUrl', 'key', 'model',
            'expressionProperties', 'data', 'templateOptions',
            'wrapper', 'modelOptions', 'watcher', 'validators',
            'noFormControl', 'hide', 'ngModelAttrs'
          ];
          $scope.fields.forEach(field => {
            var extraProps = Object.keys(field).filter(prop => allowedProperties.indexOf(prop) === -1);
            if (extraProps.length) {
              throw formlyUsability.getFormlyError(
                'you-have-specified-field-properties-that-are-not-allowed',
                `You have specified field properties that are not allowed: ${JSON.stringify(extraProps.join(', '))}`,
                field
              );
            }
          });


        }
      },
      link: function(scope, el, attrs) {
        if (attrs.hasOwnProperty('result')) {
          throw formlyUsability.getFormlyError(
            'The "result" attribute on a formly-form is no longer valid. Use "model" instead'
          );
        }
        if (attrs.name !== 'form') { // then they specified their own name
          throw formlyUsability.getFormlyError(
            'The "name" attribute on a formly-form is no longer valid. Use "form" instead'
          );
        }
        // enforce the model attribute because we're making it optional to help with migrations
        if (!attrs.hasOwnProperty('model') || !scope.model) {
          throw formlyUsability.getFormlyError(
            'The "model" attribute is required on a formly-form.'
          );
        }
      }
    };
  }
};
