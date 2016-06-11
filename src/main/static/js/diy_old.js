$(document).ready(function(){

	//if ($(".spanTable:visible > tbody > tr > .spinCol > input")[0]!= undefined)
	$("input[name='control1']").click(function(){
		var checkvalue = $("input[name='control1']:checked").val();
		var propertyvalue = $(".propertyValue").text();
		var user = $("#account").text();
		var ip = window.location.host;
		var href = window.location.href;
		console.log('start');
		//var urlstr = setting.root_url + "/" + setting.app_name + "/xml/" + setting.projectName + "/" + setting.corpusName + "/" + setting.taskName + "/" + setting.schema + (isAdjudication == undefined ? ( setting.isAdjudication ? ".Adjudication" : "" ) : ( isAdjudication ? ".Adjudication" : "")) + "/" + (annotator==undefined ? (setting.annotator == setting.remoteUser ? "" :(setting.annotator + "/") ) : (annotator + "/"));
		// next item
		if (_setting.first_item == "True" && checkvalue == "-1")
			alert('已经到了第一条！');
		else if (_setting.last_item == "True" && checkvalue == "1")
			alert('已经到了最后一条！恭喜教主大功告成！');
		else{
			console.log(_setting.pre_index, _setting.this_index, _setting.next_index);
			$.ajax({
				type: "GET", url: href, cache: false, async: false,
				data: {'pre_index': _setting.pre_index, 'this_index': _setting.this_index, 'next_index': _setting.next_index,
					 'pre_or_next': checkvalue, 'ajax': "1"},
				success:function(data){
					 	console.log("ajax return:"+data);
					 	console.log('-----------------');
					 	var arr = data.split('|=_=|');
					 	_setting.first_item = arr[0] 
					 	_setting.last_item = arr[1]
					 	var pre_span = arr[2];
					 	var span1 = arr[3];
					 	var span2 = arr[4];
					 	var sentence = arr[5];
					 	console.log("span1: "+span1, "span2: "+span2, "sentence: "+sentence);
					 	$("#rawText").html(sentence);
					 	_setting.pre_index = pre_span
					 	_setting.this_index = span1
					 	_setting.next_index = span2
					 	loadNewProject_onebyone(span1, span2);
					 	console.log('over');
					 }});			
		}

		});
	});


function immediately(){
	var span1 = $(".spanTable:visible > tbody > tr > .spinCol > input")[0];
	var span2 = $(".spanTable:visible > tbody > tr > .spinCol > input")[1];
	//var property = $(".propertyNormal")[0];
	if("\v"=="v") {
		span1.onpropertychange = span1Change;
		span2.onpropertychange = span2Change;
		//property.onpropertychange = propertyChange;
	}
	else{
		span1.addEventListener("input", span1Change,false);
		span2.addEventListener("input", span2Change,false);
		//property.addEventListener("input", propertyChange,false);
		}
	
	function span1Change(){
		if(span1.value){document.getElementById("span1").innerHTML = span1.value};
		}
	
	function span2Change(){
	if(span2.value){document.getElementById("span2").innerHTML = span2.value};
	}
	
	//function propertyChange(){
		//if(property.value){document.getElementById("pValue").innerHTML = property.value};
		//}	
}
	

