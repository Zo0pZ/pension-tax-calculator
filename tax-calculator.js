'use strict';
(function() {
    var myApp = angular.module('myApp', []);

    myApp.factory('TaxCalculatorFactory',
        function(){
            var dataFactory = {};

            dataFactory.getTaxBands = function() {
                return {
                    'data': {
                        'name': '2025/26',
                        'personalAllowance': 12570,
                        'incomeLimitForPA': 100000,
                        'bands': [
                            { 'limit': 37700, 'rate': 20 },
                            { 'limit': 112570, 'rate': 40 },
                            { 'limit': null, 'rate': 45 }
                        ]
                    }
                };
            };

            return dataFactory;
        }
    );

    // Derived the correct tax band based on the amounts entered
    myApp.filter('taxbandfilter',
        [
            function() {
                return function(taxbands, earningincome, totalincome) {
                    var _filtered = [];

                    angular.forEach(taxbands,
                        function(item) {
                            if (totalincome > item.minvalue) {
                                // Deal with earning income
                                if (earningincome > item.minvalue) {
                                    if (earningincome > item.maxvalue) {
                                        item.taxableamountincome = (item.maxvalue - item.minvalue);
                                    } else {
                                        item.taxableamountincome = (earningincome - item.minvalue);
                                    }
                                    item.amountoftaxincome = item.taxableamountincome * (item.rate / 100);
                                }
                                // Deal with total income
                                if (totalincome > item.maxvalue) {
                                    item.taxableamounttotal = (item.maxvalue - item.minvalue);
                                } else {
                                    item.taxableamounttotal = (totalincome - item.minvalue);
                                }
                                item.amountoftaxtotal = item.taxableamounttotal * (item.rate / 100);
                                // Define the tax on pension
                                item.taxonpension = item.amountoftaxtotal - item.amountoftaxincome;
                                _filtered.push(item);
                            }
                        });
                    return _filtered;
                };
            }
        ]);

    // Sum an array
    myApp.filter('sumByKey',
        function() {
            return function(data, key) {
                if (typeof (data) === 'undefined' || typeof (key) === 'undefined') {
                    return 0;
                }
                var sum = 0;
                for (var i = data.length - 1; i >= 0; i--) {
                    sum += parseInt(data[i][key]);
                }
                return sum;
            };
        });

    function MyCtrl($scope, TaxCalculatorFactory) {

        var incomeLimitForPersonalAllowance;

        // Runs @ page startup
        $scope.init = function() {
            var response = TaxCalculatorFactory.getTaxBands();

            incomeLimitForPersonalAllowance = response.data.incomeLimitForPA;

            $scope.taxbands = [];
            var minvalue = 0;
            // add personal allowance to tax bands.
            $scope.taxbands.push({
                minvalue: minvalue,
                maxvalue: response.data.personalAllowance,
                rate: 0,
                taxableamountincome: 0,
                taxableamounttotal: 0,
                amountoftaxincome: 0,
                amountoftaxtotal: 0,
                taxonpension: 0
            });
            minvalue = response.data.personalAllowance;
            // now add the published tax bands
            angular.forEach(response.data.bands,
                function(tb) {
                    var taxband = {
                        minvalue: minvalue,
                        maxvalue: (tb.limit || 999999999) + response.data.personalAllowance,
                        rate: tb.rate,
                        taxableamountincome: 0,
                        taxableamounttotal: 0,
                        amountoftaxincome: 0,
                        amountoftaxtotal: 0,
                        taxonpension: 0
                    };
                    minvalue = taxband.maxvalue;
                    $scope.taxbands.push(taxband);
                });

            // Take a copy of the original tax bands so we can reset them when required
            $scope.originaltaxbands = angular.copy($scope.taxbands);
        };

        $scope.GetDate = function() {
            if (!$scope.userInfo.mDate)
                return null;

            var bits = $scope.userInfo.mDate.split('/');
            if (bits.length < 3) {
                return null;
            } else {
                if (bits[2].length > 0 && bits[1].length > 0 && bits[0] > 0) {
                    return new Date(bits[2], (bits[1] - 1), bits[0]);
                } else return null;
            }
        }

        // The information entered by the user
        $scope.userInfo = {
            mDate: null,
            income: null,
            pensionwithdrwal: null
        };

        // Set to true to show the debug table
        $scope.isDebug = false;

        // Get total income
        $scope.totalincome = function() {
            var _total = 0;
            var _income = 0;
            var _pension = 0;
            if (!angular.isUndefined($scope.userInfo.income)) {
                _income = $scope.userInfo.income;
            }
            if (!angular.isUndefined($scope.userInfo.pensionwithdrwal)) {
                _pension = $scope.userInfo.pensionwithdrwal;
            }
            // Make them numbers
            _total = _income * 1 + _pension * 1;
            return _total;
        };

        // Sum the array passed in
        $scope.sumValue = function(data, key) {
            if (typeof (data) === 'undefined' || typeof (key) === 'undefined') {
                return 0;
            }
            var sum = 0;
            for (var i = data.length - 1; i >= 0; i--) {
                sum += parseInt(data[i][key]);
            }
            return sum;
        };

        // Get the "MKT" tax on pension. This will also include any increase in tax on income (for example if the pension withdrawal takes the total over 100K and starts reducing the PA)
        $scope.totaltax = function() {
            return $scope.sumValue($scope.taxbands, 'amountoftaxtotal') -
                $scope.sumValue($scope.basetaxbands, 'amountoftaxincome');
        }

        // Get the % of the pension that will be taxed
        $scope.taxPercentage = function() {
            var _total = 0;
            var _pi = $scope.sumValue($scope.taxbands, 'amountoftaxtotal') -
                $scope.sumValue($scope.basetaxbands, 'amountoftaxincome');
            if (!angular.isUndefined($scope.userInfo.pensionwithdrwal) && $scope.userInfo.pensionwithdrwal > 0) {
                _total = (_pi / $scope.userInfo.pensionwithdrwal) * 100;
            }
            return _total;
        };

        // Entry to update the tax bands based on a change in input
        $scope.updateposition = function() {
            // restore the original tax bands
            $scope.taxbands = angular.copy($scope.originaltaxbands);
            $scope.basetaxbands = angular.copy($scope.originaltaxbands);

            // Update tax bands based on income and pension withdrawal
            var _total = $scope.getTotalIncome();
            $scope.incomechange(_total, $scope.taxbands);

            // Update tax bands based on income only
            // By doing this we can work out if the tax on income will increase because of the pension withdrawal
            _total = 0;
            if (!angular.isUndefined($scope.userInfo.income)) {
                _total = $scope.userInfo.income;
            }
            $scope.incomechange(_total, $scope.basetaxbands);
        };

        $scope.getTotalIncome = function() {
            var _income = 0;
            var _pension = 0;
            if (!angular.isUndefined($scope.userInfo.income)) {
                _income = $scope.userInfo.income;
            }
            if (!angular.isUndefined($scope.userInfo.pensionwithdrwal)) {
                _pension = $scope.userInfo.pensionwithdrwal;
            }
            var _total = (_income * 1) + (_pension * 1);

            return _total;
        };

        // Update the tax bands based on the income entered
        $scope.incomechange = function(total, taxbands) {
            var additional = 0;

            if (total > incomeLimitForPersonalAllowance) {
                additional = ((total - incomeLimitForPersonalAllowance) / 2) * -1;
                $scope.updatetaxbandsIncomePersonalAllowance(taxbands, additional);
            }
        };

        // Update the tax bands based on the income
        $scope.updatetaxbandsIncomePersonalAllowance = function(taxbands, additional) {
            var reduction = 0;
            var maxreduction = false;
            angular.forEach(taxbands,
                function(taxband, i) {
                    var value = 0;
                    // Personal allowance band
                    if (i == 0) {
                        value = taxband.maxvalue + additional;
                        reduction = taxband.maxvalue - value;
                        if (value < 0) {
                            value = 0;
                            reduction = taxband.maxvalue;
                            maxreduction = true;
                        }
                        taxband.maxvalue = value;
                    } else {
                        taxband.minvalue = taxband.minvalue - reduction;
                        taxband.maxvalue = taxband.maxvalue - reduction;
                    }
                });
        };

        // Array to store the original tax band
        $scope.originaltaxbands = [];
        // Need a copy for use when we work out over 100K tax implications
        $scope.basetaxbands = [];

        // The tax bands
        $scope.taxbands = [];
    }

    myApp.controller('MyCtrl', ['$scope', 'TaxCalculatorFactory', MyCtrl]);

    window.MyCtrl = MyCtrl;

    $(document).ready(function() {
        angular.bootstrap(document, ['myApp']);
    });
})();
