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

    // Filter tax bands to only show applicable ones and calculate amounts
    myApp.filter('taxbandfilter',
        [
            function() {
                return function(taxbands, earningincome, totalincome) {
                    var _filtered = [];

                    angular.forEach(taxbands,
                        function(item) {
                            if (totalincome > item.minvalue) {
                                if (earningincome > item.minvalue) {
                                    if (earningincome > item.maxvalue) {
                                        item.taxableamountincome = (item.maxvalue - item.minvalue);
                                    } else {
                                        item.taxableamountincome = (earningincome - item.minvalue);
                                    }
                                    item.amountoftaxincome = item.taxableamountincome * (item.rate / 100);
                                }
                                if (totalincome > item.maxvalue) {
                                    item.taxableamounttotal = (item.maxvalue - item.minvalue);
                                } else {
                                    item.taxableamounttotal = (totalincome - item.minvalue);
                                }
                                item.amountoftaxtotal = item.taxableamounttotal * (item.rate / 100);
                                item.taxonpension = item.amountoftaxtotal - item.amountoftaxincome;
                                // Pension's share of this band
                                item.pensionamountinband = item.taxableamounttotal - item.taxableamountincome;
                                _filtered.push(item);
                            }
                        });
                    return _filtered;
                };
            }
        ]);

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
        var taxData;

        // ============================
        // Initialisation
        // ============================

        $scope.init = function() {
            var response = TaxCalculatorFactory.getTaxBands();
            taxData = response.data;
            incomeLimitForPersonalAllowance = taxData.incomeLimitForPA;

            $scope.buildStandardBands();
        };

        $scope.buildStandardBands = function() {
            $scope.taxbands = [];
            var minvalue = 0;
            $scope.taxbands.push({
                minvalue: minvalue,
                maxvalue: taxData.personalAllowance,
                rate: 0,
                taxableamountincome: 0, taxableamounttotal: 0,
                amountoftaxincome: 0, amountoftaxtotal: 0,
                taxonpension: 0, pensionamountinband: 0
            });
            minvalue = taxData.personalAllowance;
            angular.forEach(taxData.bands,
                function(tb) {
                    var taxband = {
                        minvalue: minvalue,
                        maxvalue: (tb.limit || 999999999) + taxData.personalAllowance,
                        rate: tb.rate,
                        taxableamountincome: 0, taxableamounttotal: 0,
                        amountoftaxincome: 0, amountoftaxtotal: 0,
                        taxonpension: 0, pensionamountinband: 0
                    };
                    minvalue = taxband.maxvalue;
                    $scope.taxbands.push(taxband);
                });
            $scope.originaltaxbands = angular.copy($scope.taxbands);
        };

        // Build emergency tax bands (Month 1 basis: 1/12 of annual allowances)
        $scope.buildEmergencyBands = function() {
            var bands = [];
            var monthlyPA = Math.floor(taxData.personalAllowance / 12);
            var minvalue = 0;
            bands.push({
                minvalue: 0,
                maxvalue: monthlyPA,
                rate: 0,
                taxableamountincome: 0, taxableamounttotal: 0,
                amountoftaxincome: 0, amountoftaxtotal: 0,
                taxonpension: 0, pensionamountinband: 0
            });
            minvalue = monthlyPA;
            angular.forEach(taxData.bands,
                function(tb) {
                    var annualMax = (tb.limit || 999999999) + taxData.personalAllowance;
                    var monthlyMax = tb.limit ? Math.floor(annualMax / 12) : 999999999;
                    var taxband = {
                        minvalue: minvalue,
                        maxvalue: monthlyMax,
                        rate: tb.rate,
                        taxableamountincome: 0, taxableamounttotal: 0,
                        amountoftaxincome: 0, amountoftaxtotal: 0,
                        taxonpension: 0, pensionamountinband: 0
                    };
                    minvalue = taxband.maxvalue;
                    bands.push(taxband);
                });
            return bands;
        };

        // ============================
        // User input model
        // ============================

        $scope.userInfo = {
            income: null,
            grossWithdrawal: null,
            taxFreeOption: 'each25',
            customTaxFreeAmount: null
        };

        $scope.taxMode = 'standard';
        $scope.currentStep = 1;

        // Accordion state
        $scope.accordions = {
            results: false,
            considerations: false,
            otherTax: false
        };

        $scope.toggleAccordion = function(key) {
            $scope.accordions[key] = !$scope.accordions[key];
        };

        // ============================
        // Computed properties
        // ============================

        $scope.taxFreeAmount = function() {
            var gross = ($scope.userInfo.grossWithdrawal || 0) * 1;
            if (gross <= 0) return 0;

            switch ($scope.userInfo.taxFreeOption) {
                case 'allUpfront':
                case 'each25':
                    return gross * 0.25;
                case 'custom':
                    var custom = ($scope.userInfo.customTaxFreeAmount || 0) * 1;
                    var max = gross * 0.25;
                    return Math.min(Math.max(custom, 0), max);
                default:
                    return gross * 0.25;
            }
        };

        $scope.taxablePension = function() {
            var gross = ($scope.userInfo.grossWithdrawal || 0) * 1;
            return Math.max(gross - $scope.taxFreeAmount(), 0);
        };

        $scope.totalincome = function() {
            var income = ($scope.userInfo.income || 0) * 1;
            return income + $scope.taxablePension();
        };

        $scope.getTotalIncome = function() {
            return $scope.totalincome();
        };

        // Tax on pension (total tax minus tax on income alone)
        $scope.taxOnPension = function() {
            return $scope.sumValue($scope.taxbands, 'amountoftaxtotal') -
                $scope.sumValue($scope.basetaxbands, 'amountoftaxincome');
        };

        // Tax on income only
        $scope.taxOnIncome = function() {
            return $scope.sumValue($scope.basetaxbands, 'amountoftaxincome');
        };

        // Total tax across everything
        $scope.totalTaxAll = function() {
            return $scope.sumValue($scope.taxbands, 'amountoftaxtotal');
        };

        // Pension after all tax
        $scope.pensionAfterTax = function() {
            var gross = ($scope.userInfo.grossWithdrawal || 0) * 1;
            return gross - $scope.taxOnPension();
        };

        // Income after tax
        $scope.incomeAfterTax = function() {
            var income = ($scope.userInfo.income || 0) * 1;
            return income - $scope.taxOnIncome();
        };

        // Effective tax rate on pension withdrawal
        $scope.taxPercentage = function() {
            var taxable = $scope.taxablePension();
            if (taxable > 0) {
                return ($scope.taxOnPension() / taxable) * 100;
            }
            return 0;
        };

        // Effective tax rate on the gross withdrawal (including tax-free portion)
        $scope.taxPercentageGross = function() {
            var gross = ($scope.userInfo.grossWithdrawal || 0) * 1;
            if (gross > 0) {
                return ($scope.taxOnPension() / gross) * 100;
            }
            return 0;
        };

        // ============================
        // Helpers
        // ============================

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

        // ============================
        // Step navigation
        // ============================

        $scope.goToResults = function() {
            $scope.updateposition();
            $scope.currentStep = 2;
        };

        $scope.goToInputs = function() {
            $scope.currentStep = 1;
        };

        $scope.setTaxMode = function(mode) {
            $scope.taxMode = mode;
            $scope.updateposition();
        };

        // ============================
        // Core calculation
        // ============================

        $scope.updateposition = function() {
            var income = ($scope.userInfo.income || 0) * 1;
            var taxablePension = $scope.taxablePension();

            if ($scope.taxMode === 'emergency') {
                // Emergency tax: Month 1 basis, only pension withdrawal is taxed
                // Provider doesn't know about other income
                $scope.taxbands = $scope.buildEmergencyBands();
                $scope.basetaxbands = $scope.buildEmergencyBands();

                // For emergency mode, calculate tax on just the taxable pension
                var pensionTotal = taxablePension;
                // No PA adjustment needed for emergency (it's already 1/12)
                // Apply the pension to the emergency bands
                $scope.populateBandAmounts($scope.taxbands, 0, pensionTotal);
                // Base bands: no income (emergency doesn't consider other income)
                $scope.populateBandAmounts($scope.basetaxbands, 0, 0);
            } else {
                // Standard tax: annual bands, all income considered
                $scope.taxbands = angular.copy($scope.originaltaxbands);
                $scope.basetaxbands = angular.copy($scope.originaltaxbands);

                // Adjust PA for total income
                var totalIncome = income + taxablePension;
                $scope.incomechange(totalIncome, $scope.taxbands);

                // Adjust PA for income only
                $scope.incomechange(income, $scope.basetaxbands);

                // Populate base bands with income-only amounts
                angular.forEach($scope.basetaxbands, function(band) {
                    if (income > band.minvalue) {
                        if (income > band.maxvalue) {
                            band.taxableamountincome = band.maxvalue - band.minvalue;
                        } else {
                            band.taxableamountincome = income - band.minvalue;
                        }
                        band.amountoftaxincome = band.taxableamountincome * (band.rate / 100);
                    }
                });
            }
        };

        // Populate band amounts for emergency tax mode
        $scope.populateBandAmounts = function(bands, income, total) {
            angular.forEach(bands, function(band) {
                if (total > band.minvalue) {
                    if (income > band.minvalue) {
                        band.taxableamountincome = income > band.maxvalue
                            ? band.maxvalue - band.minvalue
                            : income - band.minvalue;
                        band.amountoftaxincome = band.taxableamountincome * (band.rate / 100);
                    }
                    band.taxableamounttotal = total > band.maxvalue
                        ? band.maxvalue - band.minvalue
                        : total - band.minvalue;
                    band.amountoftaxtotal = band.taxableamounttotal * (band.rate / 100);
                    band.taxonpension = band.amountoftaxtotal - band.amountoftaxincome;
                    band.pensionamountinband = band.taxableamounttotal - band.taxableamountincome;
                }
            });
        };

        // Adjust PA based on income level
        $scope.incomechange = function(total, taxbands) {
            if (total > incomeLimitForPersonalAllowance) {
                var additional = ((total - incomeLimitForPersonalAllowance) / 2) * -1;
                $scope.updatetaxbandsIncomePersonalAllowance(taxbands, additional);
            }
        };

        $scope.updatetaxbandsIncomePersonalAllowance = function(taxbands, additional) {
            var reduction = 0;
            angular.forEach(taxbands,
                function(taxband, i) {
                    if (i == 0) {
                        var value = taxband.maxvalue + additional;
                        reduction = taxband.maxvalue - value;
                        if (value < 0) {
                            value = 0;
                            reduction = taxband.maxvalue;
                        }
                        taxband.maxvalue = value;
                    } else {
                        taxband.minvalue = taxband.minvalue - reduction;
                        taxband.maxvalue = taxband.maxvalue - reduction;
                    }
                });
        };

        // Band label descriptions for the detailed breakdown
        $scope.bandLabel = function(rate) {
            switch (rate) {
                case 0: return 'Tax on earnings up to £12,570';
                case 20: return 'Basic tax rate (£12,571 - £50,270)';
                case 40: return 'Higher tax rate (£50,271 - £125,140)';
                case 45: return 'Additional tax rate (£125,140+)';
                default: return '';
            }
        };

        // Storage arrays
        $scope.originaltaxbands = [];
        $scope.basetaxbands = [];
        $scope.taxbands = [];
    }

    myApp.controller('MyCtrl', ['$scope', 'TaxCalculatorFactory', MyCtrl]);

    window.MyCtrl = MyCtrl;

    $(document).ready(function() {
        angular.bootstrap(document, ['myApp']);
    });
})();
