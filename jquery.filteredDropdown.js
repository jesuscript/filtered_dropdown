/*global _, jQuery */

(function($){
    $.widget("ddg.filteredDropdown", {
        _$input: null,
        _selectedItem: null,
        _selectedItemName: null, //string representing the selected item. couldn't think of a better name:(
        _data: null,
        _keys: null,
        _tabWidthPx: null,
        _$results: null,
        _lastInputVal: null,
        _itemTooltip: null,
        _$selectedItemName: null,
        _matchingItems: null,
        
        options: {
            data: [],
            keys: {
                name: "Name",
                children: "ChildNodes",
                notSelectable: "NotSupported",
                fullName: "FullName"
            },
            tabWidthPx: 8,
            outerBullet: "•",
            innerBullet: "-",
            fullNameSeparator: " > ",
            inputPlaceholder: "Enter Category...",
            defaultItem: undefined,
            validIfEmpty: false,
            clearOnDelete: false //when disabled, keeps old selected value even if cleared 
        },
        _create: function () {
            this.data(this.options.data);
            this._keys = this.options.keys;
            this._tabWidthPx = this.options.tabWidthPx;
            this._itemTooltip = this.options.itemToolTip;
            this._tooltip = this.options.tooltip;
            this._matchingItems = [];

            this._buildElement();
            
            this._$input = this.element.find("input[type=text]").first();

            this._$input.focus(this._inputFocus.bind(this))
                .on("textchange", this._inputChange.bind(this))
                .blur(this._inputBlur.bind(this));

            this._inputChange();

            this.element.on("mouseup",".fd-delete-btn", this._clearAndFocus.bind(this))
                .on("mouseup",".fd-filter-btn", this._clearAndFocus.bind(this))
                .on("mousedown",".fd-arrow-btn", this._arrowMousedown.bind(this))
                .on("click", ".fd-full-name", this._selectedItemNameClick.bind(this));

            if (this.options.defaultItem) this._selectItem(this.options.defaultItem, true);


            if ($.isFunction(this._tooltip)) {
                this.element.addClass('dmtooltip');
                this.element.data('tooltip-method', this._tooltip);
                this.element.data('dmTooltip', { position: 'default' });
            }
        },
        data: function(data){
            return data ? this._data = data : this._data;
        }, 
        val: function(item){
            return item ? this._selectItem(item) : this._selectedItem;
        },
        open: function(){
            if(this.element.is(".open")) return;
            
            this._$results = $("<ul>").addClass("fd-results") //         ~旦_(^O^ )
                .css({
                    top: this.element.offset().top + this.element.outerHeight() + 1,
                    left: this.element.offset().left,
                    width: this.element.innerWidth()
                })
                .on("mousedown", "li:not(.not-selectable)",this._itemMousedown.bind(this))
                .on("mousedown", "li.not-selectable", this._notSelectableItemMousedown.bind(this))
                .on("mouseover", "li:not(.not-selectable)", this._itemMouseover.bind(this))
                .on("mousedown", function(e){ this._preventClose = true; }.bind(this))
                .on("mousewheel", this._resultsScroll.bind(this));
            
            $("body").append(this._$results);

            this.element.addClass("open");
            
            this._populateResults(true);

            $("body").on("mousedown", $.proxy(this._bodyMousedown, this));

            $(document).on("keydown", $.proxy(this._documentKeydown, this));
            $(document).on("keyup", $.proxy(this._documentKeyup, this));

            this.element.removeClass("invalid");

            this._trigger("opened");
        },
        clear: function(){
            this._selectItem();
        },
        close: function () { 
            if(!this.element.is(".open")) return;
            
            this.element.removeClass("open");
            
            this._$results && this._$results.remove();
            this._$results = null;

            $("body").off("click", this._bodyMousedown);

            $(document).off("keydown", this._documentKeydown);
            $(document).off("keyup", this._documentKeyup);

            this._selectedItemName ? this._displaySelectedItemName() : this._trySmartSelect(); 

            if(!this.isValid()) this.element.addClass("invalid");

            this._trigger("closed");
        },
        isValid: function () {
            return !!this._selectedItemName || (this.options.validIfEmpty && !this._$input.val());
        },
        redraw: function(){
            this._displaySelectedItemName();
        },
        _resultsScroll: function(e, delta){
            this._$results.scrollTop(this._$results.scrollTop() - delta * 20);
        },
        _buildElement: function(){
            if(this.element.css("position") == "static") this.element.css("position", "relative");

            var $arrowBtn = $("<a class=\"fd-arrow-btn\"></a>");
            
            $arrowBtn.append($("<span class=\"arrow-down-icon fd-arrow-icon\"></span>"))
                .append("<span class=\"arrow-up-icon fd-arrow-icon\"></span>");
            

            this.element.append($("<input type=\"text\"/>").attr("placeholder", this.options.inputPlaceholder))
                .append($("<a class=\"fd-filter-btn\"><span class=\"fd-filter-icon fd-icon\"></span></a>"))
                .append($("<a class=\"fd-delete-btn\"><span class=\"fd-delete-icon fd-icon\"></span></a>"))
                .append($arrowBtn);
        },
        _trySmartSelect: function(){
            if(this._selectedItem && this._$input.val() === this._selectedItem[this._keys.name]){
                this._selectItem(this._selectedItem);
            }else if(this._matchingItems.length === 1){
                this._selectItem(this._matchingItems[0]);
            }else{
                return false;
            }
            return true;
        },
        _selectedItemNameClick: function(e){
            this._$input.focus();
        },
        _documentKeydown: function(e){
            var $items = this._$results.find("li");
            var $currentTarget = $items.filter(".target");

            _.contains([40, 38, 13, 27], e.which) && e.preventDefault();

            switch(e.which){
            case 40: //down
                var $next = $currentTarget.nextAll(":not(.not-selectable)").first();

                if($next.length) {
                    $currentTarget.removeClass("target");
                    $next.addClass("target");
                }else if(! $currentTarget.length){
                    $items.first().addClass("target");
                }

                this._updateResultsScrollTop();

                break;
            case 38: //up
                var $prev = $currentTarget.prevAll(":not(.not-selectable)").first();

                if($prev.length){
                    $currentTarget.removeClass("target");
                    $prev.addClass("target");
                }

                this._updateResultsScrollTop();
                break;
            }
        },
        _updateResultsScrollTop: function(){
            var $currentTarget = this._$results.find("li.target");
            var scrollTop = this._$results.scrollTop();
            var resHeight = this._$results.innerHeight();
            var liHeight = $currentTarget.outerHeight();
            var liTop = $currentTarget.position().top;

            if(liHeight + liTop > resHeight){
                this._$results.scrollTop(liTop + scrollTop + liHeight - resHeight);
            }

            if(liTop < 0){
                this._$results.scrollTop(scrollTop + liTop);
            }
        },
        _documentKeyup: function(e){
            var $currentTarget = this._$results.find("li.target");

            switch(e.which){
            case 13: //enter
                if($currentTarget.length){
                    this._selectItem($currentTarget.data("item"));
                    this.close();
                    this._$input.blur();
                }else{
                    if(this._trySmartSelect()) this.close();
                }
                break;
            case 27: //escape
                this.close();
                this._$input.blur();
                break;
            }
        },
        _clearAndFocus: function(){
            this._selectItem();
            this._$input.focus();
        },
        _arrowMousedown: function(e){
            this.element.is(".open") ? this.close() : this.open(); 
        },
        _selectItem: function(item, silent){
            if(this.options.clearOnDelete || item) this._selectedItem = item;

            var itemName = item ? item[this._keys.name] : "";

            this._$input.val(itemName);
            this._selectedItemName = itemName ? itemName : "";

            this._lastInputVal = itemName;

            (!itemName) ? this.element.addClass("empty") : this.element.removeClass("empty");

            this._displaySelectedItemName(); 
            this.element.removeClass("invalid");

            if((item || this.options.clearOnDelete) && !silent) this._trigger("selected", {}, this._selectedItem);
        },
        _displaySelectedItemName: function(){
            var $selectedItemName;

            this._$selectedItemName && this._$selectedItemName.remove();
            
            if(this._selectedItemName){
                $selectedItemName = this._buildFullItemName();

                $selectedItemName.css({
                    position: "absolute",
                    top: this._$input.position().top + "px",
                    left: this._$input.position().left + "px"
                });

                this.element.append(this._$selectedItemName = $selectedItemName);

                this._truncateLeft($selectedItemName);
            }
        },
        _buildFullItemName: function(){
            var $name = $("<div>").addClass("fd-full-name");
            var fullName;
            var item = this._selectedItem;
            
            if(item[this._keys.fullName] && this.element.width()){ // i.e. element is present in dom
                fullName = item[this._keys.fullName];

                _.each(_.first(fullName, -1), function(parentName){ // add parents + separating characters
                    $name.append($("<span/>").addClass("fd-full-name-parent").text(parentName))
                        .append($("<span/>").addClass("fd-full-name-separator").text(this.options.fullNameSeparator));
                },this);
                
                return $name.append($("<span/>").addClass("fd-full-name-node").text(_.last(fullName)));
            }else{
                return $name.append($("<span/>").addClass("fd-full-name-node").text(this._selectedItemName));
            }
        },
        _truncateLeft: function($el){
            var targetWidth = $el.width();
            var fChildWidth = function($el){
                return _.reduce($el.children(), function(memo, child){ return $(child).width() + memo; }, 0);
            };

            if($el.width() >= fChildWidth($el)) return;

            $el.prepend($("<span/>").addClass("fd").html("&hellip;"));

            _.each(_.rest($el.children(), 1), function(node){
                var childWidth = fChildWidth($el);
                var $node = $(node);
                var widthWithout = childWidth - $node.width();
                var text;
                
                if(childWidth > targetWidth){
                    if(widthWithout > $el.width()){
                        $node.remove();
                    }else{
                        text = $node.text();

                        while(text.length && ($node.width() + widthWithout) > targetWidth){
                            text = text.substr(1);

                            $node.text(text);
                        }
                    }
                }
            },this);
        },
        _bodyMousedown: function(e){
            var $target = $(e.target);

            if(!this.element.has($target).length &&
               !(this._$results && (this._$results.is($target) ||this._$results.has($target).length))){
                this.close();
            }
        },
        _inputFocus: function(e){
            this._$selectedItemName && this._$selectedItemName.remove();
            
            this.open();
        },
        _inputBlur: function(e){
            if(this._preventBlur){
                this._preventBlur = false;
                
                window.setTimeout(function(){
                    this._$input.focus();
                }.bind(this));
            }else if(this._preventClose){
                this._preventClose = false;
            }else{
                this.close();
            }
        },
        _inputChange: function(e, previousVal){
            if(this._$input.val() !== previousVal && this._$input.val() !== this._lastInputVal){
                this._lastInputVal = this._$input.val();
                
                if(this._$input.val() !== ""){
                    this.element.removeClass("empty");
                }else{
                    this.element.addClass("empty");
                }
                
                this._populateResults();
                
                this._selectedItemName = "";
            }
        },
        _itemMousedown: function(e){
            var item = $(e.currentTarget).data("item");

            this._selectItem(item);

            this.close();
        },
        _notSelectableItemMousedown: function(e){
            this._preventBlur = true;
        },
        _itemMouseover: function(e){
            var $target = $(e.currentTarget);

            if(! $target.is(".target")){
                this._$results.find("li").removeClass("target");
                
                $target.addClass("target");
            }
        },
        _populateResults: function(noFilter){
            var term = this._$input.val();
            var data;


            if(this._$results){
                this._$results.empty();
                
                this._matchingItems = [];
                data = (term.length < 1 || noFilter) ? this._data : this._filter(this._data,term);
                
                if(data.length){
                    this._renderItems(data, 1, {outerLevel: true, noHighlight: noFilter});
                }else{
                    this._$results.empty().append($("<div/>").addClass("fd-no-results").text("No results found"));
                }
            }
        },
        _filter: function(items, term){ // recursive. builds a new data object with items where keys match the term
            var result = [];
            var filteredVal;

            _.each(items, function(item){
                var subItems;
                
                if(item[this._keys.name] && !item[this._keys.notSelectable] &&
                   this._searchItemNameForTerm(item[this._keys.name], term) >= 0){ //found a match
                    result.push(item);
                    
                    this._matchingItems.push(item);
                }else if(item[this._keys.children] &&
                         _.size( subItems = this._filter(item[this._keys.children], term) )){
                    
                    // i.e. value is a subtree that contains at least one key that matches the term
                    item = _.clone(item);
                    item[this._keys.children] = subItems;
                    
                    result.push(item);
                }
            }, this);

            return result;
        },
        _searchItemNameForTerm: function(itemName, term){
            return itemName.search(new RegExp(term, "i"));
        },
        _renderItems: function(items, depth, options){ // recursive
            var indent = depth * this.options.tabWidthPx + "px";
            options = options || {};

            _.each(items, function(item){
                var dep = depth;

                if(item[this._keys.name]){
                    this._renderItem(item, indent, options);
                    
                    dep++;
                }
                
                item[this._keys.children] && this._renderItems(item[this._keys.children], dep, {
                    noHighlight: options.noHighlight
                });
            }, this);
        },
        _renderItem: function(item, indent, options){
            var $bullet = $("<span/>");
            var $item = $("<li/>").css("padding-left", indent);
            var $itemName = $("<span/>").addClass("fd-item-name").text(item[this._keys.name]);

            if(item[this._keys.notSelectable]) $item.addClass("not-selectable");

            if(options.outerLevel){
                $bullet.addClass("fd-bullet outer").text(this.options.outerBullet);
            }else{
                $bullet.addClass("fd-bullet inner").text(this.options.innerBullet);
            }

            if(!options.noHighlight) $itemName = this._highlightSearchTermIn($itemName);
            
            $item.append($bullet).append($itemName);

            $item.data("item", item);

            if ($.isFunction(this._itemTooltip) && !item.NotSupported) {
                $item.addClass('dmtooltip dmTooltip-right');
                $item.data('tooltip-method', this._itemTooltip);
                $item.data('dmTooltip', {
                    position: 'right'
                });
            }
            
            this._$results.append($item);
        },
        _highlightSearchTermIn: function($itemName){
            var term = this._$input.val();
            var itemName = $itemName.text();
            var matchStart;

            if((matchStart = this._searchItemNameForTerm(itemName, term)) >= 0){
                $itemName.text("");

                $itemName.append(itemName.substr(0,matchStart))
                    .append($("<strong />").text(itemName.substr(matchStart, term.length)))
                    .append(itemName.substr(matchStart + term.length));
            }
            
            return $itemName;
        } 
    });
})(jQuery);
