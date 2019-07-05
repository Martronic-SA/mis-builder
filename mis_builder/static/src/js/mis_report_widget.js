/* Copyright 2014-2018 ACSONE SA/NV (<http://acsone.eu>)
   License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl.html). */

odoo.define('mis_builder.widget', function (require) {
"use strict";

    var AbstractField = require('web.AbstractField');
    var field_registry = require('web.field_registry');
    var time = require('web.time');

    var MisReportWidget = AbstractField.extend({

        /*
         * The following attributes are set after willStart() and are available
         * in the widget template:
         * - mis_report_data: the result of mis.report.instance.compute()
         * - show_settings: a flag that controls the visibility of the Settings
         *   button
         */

        template: "MisReportWidgetTemplate",

        events: _.extend({}, AbstractField.prototype.events, {
            'click .mis_builder_drilldown': 'drilldown',
            'click .oe_mis_builder_print': 'print_pdf',
            'click .oe_mis_builder_export': 'export_xls',
            'click .oe_mis_builder_settings': 'display_settings',
            'click .oe_mis_builder_refresh': 'refresh',
            'click .o_mis_reports-filter-subdivision ul a': 'subdivision_change',
            'click .o_mis_reports_date-filter ul a': 'date_change',
        }),

        get_context: function () {
            var self = this;
            var context = self.getParent().state.context;
            context.period = self.period;
            context.subdivision = self.subdivision;
            if (self.period == 'custom') {
                context.date_from = self.date_from;
                context.date_to = self.date_to;
            }
            return context;
        },

        /**
         * Return the id of the mis.report.instance to which the widget is
         * bound.
         */
        _instance_id: function () {
            if (this.value) {
                return this.value;
            }

            /*
             * This trick is needed because in a dashboard the view does
             * not seem to be bound to an instance: it seems to be a limitation
             * of Odoo dashboards that are not designed to contain forms but
             * rather tree views or charts.
             */
            var context = this.get_context();
            if (context['active_model'] === 'mis.report.instance') {
                return context['active_id'];
            }
        },

        /**
         * Method called between @see init and @see start. Performs asynchronous
         * calls required by the rendering and the start method.
         */
        willStart: function () {
            var self = this;
            var context = this.get_context();

            var def0 = self._rpc({
                model: 'mis.report.instance',
                method:"read",
                args:[self._instance_id(), ['id', 'use_automatic_periods', 'default_period', 'subdivision', 'date_from', 'date_to']],
                context: context,
            }).then(function(result){
                var result = result[0];
                self.report_id = result['id'];
                self.use_automatic_periods = result['use_automatic_periods'];
                if (self.period == null) {
                    self.period = result['default_period'];
                    context.period = self.period;
                }
                if (self.subdivision == null) {
                    self.subdivision = result['subdivision'];
                    context.subdivision = self.subdivision;
                }
                if (result['date_from'] && self.date_from == null && result['date_to'] && self.date_from == null && self.period == 'custom') {
                    self.date_from = result['date_from'];
                    self.date_to = result['date_to'];
                    context.date_from = self.date_from;
                    context.date_to = self.date_to;
                }
            });

            var def1 = self._rpc({
                model: 'mis.report.instance',
                method: 'compute',
                args: [self._instance_id()],
                context: context,
            }).then(function (result) {
                self.mis_report_data = result;
            });

            var def2 = self._rpc({
                model: 'res.users',
                method: 'has_group',
                args: ['account.group_account_user'],
                context: context,
            }).then(function (result) {
                self.show_settings = result;
            });

            return $.when(this._super.apply(this, arguments), def1, def2);
        },

        refresh: function () {
            this.replace();
        },

        subdivision_change: function(event) {
            var self = this;
            var listitem = $(event.target).closest('li');
            var value = listitem.data('value');
            self.subdivision = value;
            self.refresh();
        },

        date_change: function(event) {
            var self = this;
            var listitem = $(event.target).closest('li');
            if ($(event.target).hasClass('custom_dates')) {
                event.stopImmediatePropagation();
                var $buttons_list = listitem.parent();
                var $datetimepickers = $buttons_list.find('.o_mis_reports_datetimepicker');
                var l10n = core._t.database.parameters;
                var options = { // Set the options for the datetimepickers
                    language : moment.locale(),
                    format : time.strftime_to_moment_format(l10n.date_format),
                    icons: {
                        date: "fa fa-calendar",
                    },
                    pickTime: false,
                };
                $datetimepickers.each(function () {
                    $(this).datetimepicker(options);
                    if($(this).data('default-value')) {
                        $(this).data("DateTimePicker").setValue(moment($(this).data('default-value')));
                    }
                });
                $buttons_list.find('button.btn-primary').bind('click', function (event) {
                    var listitem = $(event.target).closest('li');
                    var date_from = listitem.find('input[name="date_from"]').val();
                    var date_to = listitem.find('input[name="date_to"]').val();
                    if (date_from != undefined && date_to != undefined) {
                        self.period = 'custom';
                        self.date_from = field_utils.parse.date(date_from);
                        self.date_to = field_utils.parse.date(date_to);
                        self.refresh();
                    }
                });
                if (listitem.hasClass('o_open_menu')) {
                    listitem.parent().find('.o_mis_reports_custom-dates').addClass('hidden');
                    listitem.removeClass('o_open_menu');
                    listitem.addClass('o_closed_menu');
                } else {
                    listitem.parent().find('.o_mis_reports_custom-dates').removeClass('hidden');
                    listitem.addClass('o_open_menu');
                    listitem.removeClass('o_closed_menu');
                }
            }
            else {
                var value = listitem.data('value');
                self.period = value;
                self.refresh();
            }
        },

        print_pdf: function () {
            var self = this;
            var context = self.get_context();
            this._rpc({
                model: 'mis.report.instance',
                method: 'print_pdf',
                args: [this._instance_id()],
                context: context,
            }).then(function (result) {
                self.do_action(result);
            });
        },

        export_xls: function () {
            var self = this;
            var context = self.get_context();
            this._rpc({
                model: 'mis.report.instance',
                method: 'export_xls',
                args: [this._instance_id()],
                context: context,
            }).then(function (result) {
                self.do_action(result);
            });
        },

        display_settings: function () {
            var self = this;
            var context = self.get_context();
            this._rpc({
                model: 'mis.report.instance',
                method: 'display_settings',
                args: [this._instance_id()],
                context: context,
            }).then(function (result) {
                self.do_action(result);
            });
        },

        drilldown: function (event) {
            var self = this;
            var context = self.get_context();
            var drilldown = $(event.target).data("drilldown");
            this._rpc({
                model: 'mis.report.instance',
                method: 'drilldown',
                args: [this._instance_id(), drilldown],
                context: context,
            }).then(function (result) {
                self.do_action(result);
            });
        },
    });

    field_registry.add("mis_report_widget", MisReportWidget);

    return MisReportWidget;

});
