$(document).ready(function(){
	_setting.has_fullfill = false;


	if (relationFrame != undefined){
		console.log('hello');
	//选中显示当前Relation来刷新邮编的PROPERTY
	alert(_setting.sentenceidx);
	selectAObj(displayRelationList[_setting.sentenceidx]);
	relationFrame.selectedRelationRow = relationFrame.tbody.children('tr')[1];
	$('.objDeleteBtn').hide();
	}
});

	var checkvalue = undefined;

	function pre_click(){
		console.log('1!');
		checkvalue = -1;
		flip(checkvalue);
	};
	
	function next_click(){
		console.log('2!');
		checkvalue = 1;
		flip(checkvalue);
	};	

	function flip(value){
	if (value != undefined){
		// hard code!!!
		var labelname = '结果';
		if (relationFrame.selectedRelationRow.context !=undefined)
			_setting.has_fullfill = (relationFrame.selectedRelationRow.context.innerText.indexOf(labelname) > 0) ? true : false;		
		else if (relationFrame.selectedRelationRow[0] != undefined)
			_setting.has_fullfill = (relationFrame.selectedRelationRow[0].innerText.indexOf(labelname) > 0) ? true : false;			
		else
			_setting.has_fullfill = (relationFrame.selectedRelationRow.innerText.indexOf(labelname) > 0) ? true : false;			
		if (_setting.sentenceidx == 0 && value == -1)
			alert('已经到了第一条！');
		else if (_setting.sentenceidx == _setting.maxsenidx && value == 1)
			alert('已经到了最后一条！恭喜教主大功告成！');
		else if (value == 1 && !_setting.has_fullfill){
			alert('请填写属性！');
		}
		else{
			_setting.previous_spanElementList = currentAProject.annotateFrame.spanElementList;
			_setting.pre_or_next = value;
			currentAProject.annotateFrame.updateAnnotateFragement();
			if (relationFrame != undefined){
				//选中显示当前Relation来刷新邮编的PROPERTY
				selectAObj(displayRelationList[_setting.sentenceidx]);
				relationFrame.selectedRelationRow = relationFrame.tbody.children('tr')[1];
				$('.objDeleteBtn').hide();
				_setting.has_fullfill = false;
				temporalSave();
			}
			if (value == 1)
				_setting.startIdx += 1
		}
		//checkvalue = undefined;
	}
}

/**
 * 替换所有匹配exp的字符串为指定字符串
 * @param exp 被替换部分的正则
 * @param newStr 替换成的字符串
 */
String.prototype.replaceAll = function (exp, newStr) {
    return this.replace(new RegExp(exp, "gm"), newStr);
};

/**
 * 原型：字符串格式化
 * @param args 格式化参数值
 */
String.prototype.format = function(args) {
    var result = this;
    if (arguments.length < 1) {
        return result;
    }

    var data = arguments; // 如果模板参数是数组
    if (arguments.length == 1 && typeof (args) == "object") {
        // 如果模板参数是对象
        data = args;
    }
    for ( var key in data) {
        var value = data[key];
        if (undefined != value) {
            result = result.replaceAll("\\{" + key + "\\}", value);
        }
    }
    return result;
}