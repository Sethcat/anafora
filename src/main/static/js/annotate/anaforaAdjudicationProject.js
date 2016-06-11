function AnaforaAdjudicationProject(schema, task) {
	AnaforaProject.call(this, schema, "gold", task)

	this.projectList = undefined;
	this.completeAdjudication = 0;
	this.totalAdjudication = 0;

	this.progressBar = $("#progress");
	this.adjudicationEntityList = {}; // store the adjudication entity
	this.adjudicationRelationList = {}; // store the adjudication relation

	this.identicalEntityMarkAsGold = true;
}

AnaforaAdjudicationProject.prototype = new AnaforaProject();
AnaforaAdjudicationProject.prototype.constructor = AnaforaAdjudicationProject;

AnaforaAdjudicationProject.prototype.addAnaforaProjectList = function(projectList) {

	this.projectList = projectList;

	var _self = this;
	var entityList = [];
	var relationList = [];
	var idx=0, entityLength,followIdx=0, xIdx=0 ;
	var relationLength;
	var comparePairEntityList;

	if(projectList == undefined)
		return;

	// compare 
	$.each(projectList, function(annotator, aProject) {
		entityList[idx] = $.map( aProject.entityList, function(value) {return value;});
		entityList[idx].sort(Entity.sort);

		relationList[idx] = $.map( aProject.relationList, function(value) {return value;});
		relationList[idx].sort(Relation.sort);

		idx++;
		// update maxEntityIdx and maxRelationIdx
		_self.maxEntityIdx = Math.max(aProject.maxEntityIdx, _self.maxEntityIdx);
		_self.maxRelationIdx = Math.max(aProject.maxRelationIdx, _self.maxRelationIdx);
	});

	//// check the AdjuidcationEntity
	entityListIdx = [];
	entityListIdx[0] = 0;
	entityListIdx[1] = 0;

	while(entityListIdx[0] < entityList[0].length && entityListIdx[1] < entityList[1].length) {
		idx = (Entity.sort(entityList[0][ entityListIdx[0] ], entityList[1][ entityListIdx[1] ]) <= 0) ? 0 : 1;
		xIdx = (idx==1) ? 0 : 1;
		followIdx = 0;

		var idx0 = entityListIdx[idx];
		var idx1 = entityListIdx[xIdx];
		var entityList0 = entityList[idx];
		var entityList1 = entityList[xIdx];
		var entity0, entity1;
		var adjEntity;
		var comparePariList0, comparePairList1;
		var needAddAdjudicationEntity;
		var annotator0, annotator1;
		var term0, term1;
		var diffProp;
		var spanEqual;

		while( (idx1 + followIdx) < entityList1.length && (entityList0[idx0].span[entityList0[idx0].span.length-1].end > entityList1[idx1+followIdx].span[0].start ) ) {
			if( entityList0[ idx0 ].type === entityList1[ idx1+followIdx ].type ) {
				entity0 = entityList[idx][ entityListIdx[idx] ];
				entity1 = entityList[xIdx][ entityListIdx[xIdx] + followIdx ];
				term0 = entity0.id.split('@');
				term1 = entity1.id.split('@');
				annotator0 = term0[3];
				annotator1 = term1[3];

				needAddAdjudicationEntity = false;
				diffProp = undefined;
				spanEqual = false;
				
				if(annotator0 == "gold" || annotator1 == "gold") {
					if(term0[0] === term1[0]) {
						// same gold data
						var eIdx = parseInt(term0[0]);
						$.each(projectList, function(annotator, aProject) {
							if(aProject.entityList[eIdx] != entity0) {
								aProject.entityList[eIdx] = entity0;
								$.each(entity1.linkingAObjList, function(ttIdx, linkingAObj) {
									$.each(linkingAObj.type.propertyTypeList, function(tttIdx, pType) {
										if(pType.input == InputType.LIST && linkingAObj.propertyList[tttIdx] != undefined) {
											var pIdx = linkingAObj.propertyList[tttIdx].indexOf(entity1);
											if(pIdx > -1)
												linkingAObj.propertyList[tttIdx][pIdx] = entity0;
										}
									});
								});
								// move linkedAObj from entity1 to entity0
								entity0.linkingAObjList = entity0.linkingAObjList.concat(entity1.linkingAObjList);
								if(_self.annotateFrame != undefined)
									_self.annotateFrame.removeEntityPosit(entity0, entity1, true);
								entity0.setAdditionalData("adjudication", "gold");
								
							}
						});
						_self.entityList[eIdx] = entity0

						_self.addTypeCount(entity0.type);
					}

					needAddAdjudicationEntity = false;
				}
				else {
					var compareRObj = Entity.comparePairCheck(entity0, entity1);
					needAddAdjudicationEntity = compareRObj.needAddAdjudicationEntity;
					diffProp = compareRObj.diffProp;
					spanEqual = compareRObj.spanEqual;
				}

				if(needAddAdjudicationEntity) {
					if(spanEqual && diffProp.length == 0 && _self.identicalEntityMarkAsGold) {
						_self.markGold(entity0);
						entity1.setAdditionalData("adjudication", "not gold");
					}
					var newAdjEntity = new AdjudicationEntity(this.getNewEntityId(), entity0.type, [entity0, entity1], diffProp);
					this.addAdjEntityToAdjudicationInCompareEntityPair(entity0, entity1, newAdjEntity);
					this.addAdjEntityToAdjudicationInCompareEntityPair(entity1, entity0, newAdjEntity);
					this.addAdjAObj(newAdjEntity);
					if(_self.annotateFrame != undefined)
						_self.annotateFrame.updatePosIndex(newAdjEntity);
					_self.addTypeCount(newAdjEntity.type);
				}
			}
			followIdx++;
		}
		entityListIdx[idx]++;
	}

	//// check the AdjuidcationRelation
	
	relationListIdx = [];
	relationListIdx[0] = 0;
	entityListIdx[1] = 0;
	var comparePairRelationList0;
	var comparePairRelationList1;

	$.each(relationList[0], function(key0, relation0) {
		var currentDiffProp = relation0.type.propertyTypeList.length + 1;
		$.each(relationList[1], function(key1, relation1) {
			comparePairRelationList1 = relation1.getAdditionalData("comparePair");
			if(relation0.type == relation1.type) {

				var diffProp = IAdjudicationAnaforaObj.compareAObjPropertyList(relation0, relation1, AnaforaAdjudicationProject.adjEntityComparePropertyFunc);
				if(diffProp.length < 2 && diffProp.length < currentDiffProp && (comparePairRelationList1 == undefined || comparePairRelationList1[1].diffProp.length > currentDiffProp) && _self.relationAdjFilter(diffProp)) {
					currentDiffProp = diffProp.length;
					// update diffProp

					if(diffProp.length == 0) {
						_self.markGold(relation0);
						relation1.setAdditionalData("adjudication", "not gold");
					}

					comparePairRelationList0 = relation0.getAdditionalData("comparePair");
					if(comparePairRelationList0 != undefined) {
						var tAdjIdx = parseInt(comparePairRelationList0[1].id.split('@')[0]);
						_self.delTypeCount(_self.adjudicationRelationList[tAdjIdx].type);
						if(_self.annotateFrame != undefined)
							_self.annotateFrame.removeAObj(_self.adjudicationRelationList[tAdjIdx]);
						delete _self.adjudicationRelationList[tAdjIdx];

						comparePairRelationList0[0].setAdditionalData("comparePair");
						comparePairRelationList0[0].setAdditionalData("adjudication");
					}

					if(comparePairRelationList1 != undefined) {
						var tAdjIdx = parseInt(comparePairRelationList1[1].id.split('@')[0]);
						_self.delTypeCount(_self.adjudicationRelationList[tAdjIdx].type);
						if(_self.annotateFrame != undefined)
							_self.annotateFrame.removeAObj(_self.adjudicationRelationList[tAdjIdx]);
						delete _self.adjudicationRelationList[tAdjIdx];
						comparePairRelationList1[0].setAdditionalData("comparePair");
						comparePairRelationList1[0].setAdditionalData("adjudication");
					}

					var newAdjRelation = new AdjudicationRelation(_self.getNewRelationId(), relation0.type, [relation0, relation1], diffProp);


					var adjIdx = parseInt(newAdjRelation.id.split('@')[0]);
					_self.adjudicationRelationList[adjIdx] = newAdjRelation;
					_self.addTypeCount(newAdjRelation.type);


					relation0.setAdditionalData("comparePair", [relation1, newAdjRelation]);
					relation1.setAdditionalData("comparePair", [relation0, newAdjRelation]);
					if(_self.annotateFrame != undefined)
						_self.annotateFrame.updatePosIndex(newAdjRelation);
				}
			}
		});
	});

	// recount the adjudicationEntityList, typeCount, update posit index, and count the adjudication complete number
	$.each(this.typeCount, function(tType) {
		_self.typeCount[tType] = -(_self.typeCount[tType]);
	});

	$.each(projectList, function(annotator, aProject) {
		// add type count to adj project
		$.each(aProject.typeCount,function(tType) {
			if(_self.typeCount[tType] == undefined)
				_self.typeCount[tType] = 0;

			_self.typeCount[tType] += aProject.typeCount[tType];
		});

		// update number of total adjudication
		_self.totalAdjudication += Object.keys(aProject.entityList).length;
		_self.totalAdjudication += Object.keys(aProject.relationList).length;
	});

	this.totalAdjudication -= Object.keys(this.adjudicationEntityList).length;
	this.totalAdjudication -= Object.keys(this.entityList).length;
	this.totalAdjudication -= Object.keys(this.adjudicationRelationList).length;
	this.totalAdjudication -= Object.keys(this.relationList).length;


	this.completeAdjudication += Object.keys(this.entityList).length;
	this.completeAdjudication += Object.keys(this.relationList).length;

	//this.updatePosIndex(entityList[entityLength-1]);

	if(this.annotateFrame != undefined)
		this.annotateFrame.generateAllAnnotateOverlapList();

	this.updateProgressBar();
	temporalSave();
}

AnaforaAdjudicationProject.adjEntityComparePropertyFunc = function(aObj0, aObj1, filterFunc) {

	if(!(aObj0 instanceof IAnaforaObj) || !(aObj1 instanceof IAnaforaObj))
		throw "input object for adjEntityCompareProperty is not IAnaforaObj";
	if(aObj0 === aObj1)
		return true;

	var comparePairEntityList0 = aObj0.getAdditionalData("comparePair");
	var comparePairEntityList1 = aObj1.getAdditionalData("comparePair");

	if(aObj0 instanceof Entity && aObj1 instanceof Entity) {
		if(comparePairEntityList0 != undefined && comparePairEntityList1 != undefined && comparePairEntityList0.length > 1 && comparePairEntityList1.length > 1) {
			if(comparePairEntityList0[comparePairEntityList0.length -1] instanceof AdjudicationEntity && comparePairEntityList1[comparePairEntityList1.length -1] instanceof AdjudicationEntity && comparePairEntityList0[0] == aObj1 && comparePairEntityList1[0] == aObj0)
				if(filterFunc != undefined) {
					return filterFunc(aObj0, aObj1);
				}
				else
					return true;
		}

		return false;
	}
	else {
		return IAnaforaObj.compareAObjFunc(aObj0, aObj1);
	}
}


AnaforaAdjudicationProject.adjEntityStrictComparePropertyFunc = function(aObj0, aObj1) {
	if (aObj0 === aObj1)
		return true;
	var comparePairEntityList0 = aObj0.getAdditionalData("comparePair");
	var comparePairEntityList1 = aObj1.getAdditionalData("comparePair");

	var adjEntity = comparePairEntityList0[comparePairEntityList0.length - 1];

	return adjEntity.decideIdx !== undefined;
}

AnaforaAdjudicationProject.prototype.relationAdjFilter = function(diffProp) {
	return true;
}

AnaforaAdjudicationProject.prototype.addAdjEntityToAdjudicationInCompareEntityPair = function(entity, comparedEntity, adjEntity ) {
	if(entity.id.split('@')[3] == comparedEntity.id.split('@')[3]) {
		throw "same annotator name: " + entity.id.split('@')[3] + ", " + comparedEntity.id.split('@')[3];
	}
	// In the compareEntityPair list, remove the adjEntity if exist, set comparedEntity position, and set the adjEntity position
	if(entity.type !== comparedEntity.type)
		throw "add adjudication compare pair error: entity type: " + entity.type + ", comparedEntity type: " + comparedEntity.type;

	if(entity.getAdditionalData("comparePair") == undefined) {
		entity.setAdditionalData("comparePair", []);
	}
		
	var comparePairEntityList = entity.getAdditionalData("comparePair");

	if(comparePairEntityList[comparePairEntityList.length-1] instanceof AdjudicationEntity){
			this.resetFollowEntityInCompareEntityPair(comparePairEntityList[0]);
			comparePairEntityList.pop();
	}

	comparePairEntityList.splice(0, 0, comparedEntity);
	comparePairEntityList.push(adjEntity);
}

AnaforaAdjudicationProject.prototype.resetFollowEntityInCompareEntityPair = function(resetEntity) {
	// remove the original adjudicationEntity that contain resetEntity, find out the next possible compareentityPair from the compareEntityPair list
	var idx;
	var tEntity = undefined;
	var tComparePairEntityList;
	var resetComparePairEntityList = resetEntity.getAdditionalData("comparePair");

	if(resetComparePairEntityList != undefined && resetComparePairEntityList.length >= 2 && resetComparePairEntityList[resetComparePairEntityList.length -1] instanceof AdjudicationEntity && resetComparePairEntityList[resetComparePairEntityList.length -1].decideIdx == undefined) {
		for(idx=1;idx<resetComparePairEntityList.length-1;idx++) {
			var tEntity = resetComparePairEntityList[idx];
			tComparePairEntityList = tEntity.getAdditionalData("comparePair");
			if(!(tComparePairEntityList[tComparePairEntityList.length-1 ] instanceof AdjudicationEntity) && IAdjudicationAnaforaObj.compareAObjPropertyList(resetEntity, tEntity).length == 0) {
				break;
			}
			tEntity = undefined;
		}

		var removeAdjEntity = resetComparePairEntityList.pop();
		if(tEntity != undefined) {
			resetComparePairEntityList.push(new AdjudicationEntity(this.getNewEntityId(), resetEntity.type, [resetEntity, tEntity]));
			resetComparePairEntityList[0] = resetComparePairEntityList.splice(idx, 1, resetComparePairEntityList[0])[0];
		}
		this.removeAdjAObj(removeAdjEntity);
	}
}

AnaforaAdjudicationProject.prototype.removeAdjAObj = function(delAdjAObj) {
	var id = parseInt(delAdjAObj.id.split('@')[0]);
	if(delAdjAObj instanceof AdjudicationEntity) {
		delete this.adjudicationEntityList[id];
	}
	else if(delAdjAObj instanceof AdjudicationRelation) {
		delete this.adjudicationRelationList[id];
	}
}

AnaforaAdjudicationProject.prototype.splitAdjAObj = function(splitedAdjAObj) {
	var _self = this;
	if(splitedAdjAObj instanceof AdjudicationEntity || splitedAdjAObj instanceof AdjudicationRelation) {
		
		this.removeAdjAObj(splitedAdjAObj);

		if(_self.annotateFrame !== undefined)
			_self.annotateFrame.removeAObj(splitedAdjAObj);

		$.each(splitedAdjAObj.compareAObj, function(idx, aObj) {
			aObj.setAdditionalData("comparePair");
		});

		this.totalAdjudication++;

		this.updateProgressBar();
	}
}

AnaforaAdjudicationProject.prototype.addAdjAObj = function(addAdjAObj) {
	var id = parseInt(addAdjAObj.id.split('@')[0]);
	if(addAdjAObj instanceof AdjudicationEntity) {
		this.adjudicationEntityList[id] = addAdjAObj;
	}
	else if(addAdjAObj instanceof AdjudicationRelation) {
		this.adjudicationRelationList[id] = addAdjAObj;
	}
}

AnaforaAdjudicationProject.prototype.removeAObj = function(delAObj) {

	var terms = delAObj.id.split('@');
	var idx = parseInt(terms[0]);
	var annotator = terms[3];

	var comparePairList = delAObj.getAdditionalData("comparePair");
	if(comparePairList == undefined)
	{
		if(annotator == "gold") {
			AnaforaProject.prototype.removeAObj.call(this, delAObj);
		}
		else {
			this.projectList[annotator].removeAObj(delAObj);
			this.delTypeCount(delAObj.type);
		}
	
		this.totalAdjudication--;
		if(delAObj.getAdditionalData("adjudication") === "gold")
			this.completeAdjudication--;
	}
	else {
		// remove adjudicationAObj
		if(this.annotateFrame != undefined) {
			if(delAObj instanceof Entity)
				this.annotateFrame.removeEntityPosit(comparePairList[1], comparePairList[1]);
			else
				this.annotateFrame.removeRelationPosit(comparePairList[1], comparePairList[1]);

		}

		if(comparePairList[0].getAdditionalData("adjudication") !== "gold") {
			this.markGold(comparePairList[0]);
		}

		comparePairList[0].setAdditionalData("comparePair");

		this.removeAdjAObj(comparePairList[1]);
		this.projectList[annotator].removeAObj(delAObj);
	}
	this.updateProgressBar();
	temporalSave();
}

AnaforaAdjudicationProject.prototype.updateProgressBar = function() {
	this.progressBar.children("progress").attr("value", this.completeAdjudication ); 
	this.progressBar.children("progress").attr("max", this.totalAdjudication ); 
	this.progressBar.children("span").text(this.completeAdjudication.toString() + " / " + this.totalAdjudication.toString() ); 


	$("#schemaWrapper").css("bottom", (this.progressBar.height() + 5).toString() + "px");
	this.progressBar.show();
}

AnaforaAdjudicationProject.prototype.getXMLEntityList = function() {
	var rStr = "";
	
	if(this.projectList != undefined) {
	$.each(this.projectList, function(accountName, aProject) {
		rStr += aProject.getXMLEntityList();
	});
	}

	rStr += AnaforaProject.prototype.getXMLEntityList.call(this);

	return rStr;
}

AnaforaAdjudicationProject.prototype.getXMLRelationList = function() {
	var rStr = "";

	if(this.projectList != undefined) {
	$.each(this.projectList, function(accountName, aProject) {
		rStr += aProject.getXMLRelationList();
	});
	}

	rStr += AnaforaProject.prototype.getXMLRelationList.call(this);
	return rStr;
}

AnaforaAdjudicationProject.prototype.getXMLAdjudicationList = function() {
	var rStr = "";
	var _self = this;
	$.each(this.adjudicationEntityList, function(idx) {
		rStr += _self.adjudicationEntityList[idx].toXMLString() + '\n\n';
	});
	$.each(this.adjudicationRelationList, function(idx) {
		rStr += _self.adjudicationRelationList[idx].toXMLString() + '\n\n';
	});
	return rStr;
}

AnaforaAdjudicationProject.prototype.updateProperty = function(aObj, pIdx, value) {
	var comparePair;
	AnaforaProject.prototype.updateProperty.call(this, aObj, pIdx, value);

	// mark new linked aObj as gold
	if(aObj.type.propertyTypeList[pIdx].input == InputType.LIST) {

		if(aObj.getAdditionalData("adjudication") == "gold") {
			if(!(value instanceof AdjudicationEntity || value instanceof AdjudicationRelation) && (value.getAdditionalData("adjudication") !== "gold"))
				this.markGold(value);
		}
	}
	
	if((comparePair = aObj.getAdditionalData("comparePair")) != undefined) {

		var adjObj = comparePair[comparePair.length-1];
		IAdjudicationAnaforaObj.prototype.updateProperty.call(adjObj, pIdx);
	}
}

AnaforaAdjudicationProject.prototype.markGold = function(goldAObj) {
	var _self = this;
	if(goldAObj.getAdditionalData("adjudication") == "gold")
		return ;

	var compareList = goldAObj.getAdditionalData("comparePair");
	if(compareList != undefined && compareList.length >= 2 && compareList[compareList.length-1].__proto__.parent !== undefined && compareList[compareList.length-1].__proto__.parent == IAdjudicationAnaforaObj ) {
		var adjAObj = compareList[compareList.length-1];
		var goldIdx = adjAObj.compareAObj.indexOf(goldAObj);
		var notGoldIdx = (goldIdx == 0) ? 1 : 0 ;

		if(adjAObj.decideIdx == undefined) {
			this.completeAdjudication++;
		}
		adjAObj.compareAObj[notGoldIdx].setAdditionalData("adjudication", "not gold");
		adjAObj.decideIdx = goldIdx;
	}
	else
		this.completeAdjudication++;

	goldAObj.setAdditionalData("adjudication", "gold");

	// mark all linked aObj as gold
	$.each(goldAObj.type.propertyTypeList, function(idx, propType) {
		if(propType.input == InputType.LIST) {
			if(goldAObj.propertyList[idx] != undefined) {
				$.each(goldAObj.propertyList[idx], function(aIdx, aObj) {
					_self.markGold(aObj);
				});
			}
		}
	});
}

AnaforaAdjudicationProject.prototype.cancelGold = function(cancelAObj) {
	var _self = this;
	if(cancelAObj.getAdditionalData("adjudication") === undefined)
		return ;

	var compareList = cancelAObj.getAdditionalData("comparePair");
	if(compareList != undefined && compareList.length >= 2 && compareList[compareList.length-1].__proto__.parent !== undefined && compareList[compareList.length-1].__proto__.parent == IAdjudicationAnaforaObj ) {
		var adjAObj = compareList[compareList.length-1];
		if(adjAObj.decideIdx !== undefined) {
			this.completeAdjudication--;
			adjAObj.decideIdx = undefined;
		}

		adjAObj.compareAObj[0].setAdditionalData("adjudication");
		adjAObj.compareAObj[1].setAdditionalData("adjudication");
	}
	else {
		if(cancelAObj.getAdditionalData("adjudication") == "gold")
			this.completeAdjudication--;
		cancelAObj.setAdditionalData("adjudication");
	}
}

AnaforaAdjudicationProject.prototype.addAObj = function(newAObj) {
	AnaforaProject.prototype.addAObj.call(this, newAObj);
	newAObj.setAdditionalData("adjudication", "gold");
	this.completeAdjudication++;
	this.totalAdjudication++;
	this.updateProgressBar();
}

AnaforaAdjudicationProject.prototype.adjudicationCompleted = function() {
	var _self = this;
	if((this.completeAdjudication < this.totalAdjudication) && !window.confirm("Still some annotations not been adjudicated. Confirm to mark completed?") )
		return ;

	var checkNonGoldObj = this.checkNotgoldLinking();
	if(checkNonGoldObj != undefined && !window.confirm("Gold Annotation " + checkNonGoldObj.errorAObj.id + " linked to Non-gold annotation " + checkNonGoldObj.linkedAObj.id + ". Confirm to mark completed?"))
		return ;


	this.setCompletedProcess();

	temporalSave();
	saveFile();
	setCompleted();
	window.location.reload();
}

AnaforaAdjudicationProject.prototype.setCompletedProcess = function() {
	var _self = this;

	// adjudication project entity and relation list: leave gold data, delete non-gold data
	$.each(this.entityList, function(idx, entity) {
		var entity = _self.entityList[idx];
		if(entity.getAdditionalData("adjudication") !== "gold")
			delete _self.entityList[idx];
		else {
			entity.setAdditionalData("adjudication", undefined);
			entity.setAdditionalData("comparePair", undefined);
		}
	});

	$.each(this.relationList, function(idx, relation) {
		if(relation.getAdditionalData("adjudication") !== "gold")
			delete _self.relationList[idx];
		else {
			relation.setAdditionalData("adjudication", undefined);
			relation.setAdditionalData("comparePair", undefined);
		}
	});

	// each separate project: changes signal gold annotation id to gold(with the idShift), move to adjudication project entity and relation list
	// remove everything from both project entity and relation list
	$.each(this.projectList, function(annotatorName) {
		$.each(_self.projectList[annotatorName].entityList, function(idx) {
			var entity = _self.projectList[annotatorName].entityList[idx];
			var comparePairList = undefined;
			if(entity.getAdditionalData("adjudication") === "gold" && entity.id.split('@')[3] != "gold" && ((comparePairList = entity.getAdditionalData("comparePair")) == undefined || (!(comparePairList[comparePairList.length-1] instanceof AdjudicationEntity) && !(comparePairList[comparePairList.length-1] instanceof AdjudicationRelation)))) {
				entity.setAdditionalData("adjudication", undefined);
				entity.setAdditionalData("comparePair", undefined);
				var newID = _self.getNewEntityId();
				var newIdx = parseInt(newID.split('@')[0]);
				entity.id = newID;
				if(_self.entityList[newIdx] != undefined)
					throw "entity idx:" + newIdx.toString() + " not empty!";

				_self.entityList[newIdx] = entity;

			}
			delete _self.projectList[annotatorName].entityList[idx];
		});

		$.each(_self.projectList[annotatorName].relationList, function(idx) {
			var relation = _self.projectList[annotatorName].relationList[idx];
			var comparePairList = undefined;
			if(relation.getAdditionalData("adjudication") === "gold" && relation.id.split('@')[3] != "gold" && ((comparePairList = relation.getAdditionalData("comparePair")) == undefined || (!(comparePairList[comparePairList.length-1] instanceof AdjudicationEntity) && !(comparePairList[comparePairList.length-1] instanceof AdjudicationRelation)))) {
				relation.setAdditionalData("adjudication", undefined);
				relation.setAdditionalData("comparePair", undefined);
				var newID = _self.getNewRelationId();
				var newIdx = parseInt(newID.split('@')[0]);
				relation.id = newID;
				if(_self.relationList[newIdx] != undefined)
					throw "relation idx:" + newIdx.toString() + " not empty!";

				_self.relationList[newIdx] = relation;

			}
			delete _self.projectList[annotatorName].relationList[idx];
		});
	});

	// adjudication entity and relation list: set the adjudication annotation to the selected gold annotation, move to the project entity and relation list; delete non-gold adjudication annotation
	$.each(this.adjudicationEntityList, function(idx, entity) {
		if(entity.decideIdx !== undefined) {
			entity.compareAObj[entity.decideIdx].id = entity.id;
			_self.entityList[idx] = entity.compareAObj[entity.decideIdx];
			_self.entityList[idx].setAdditionalData("adjudication", undefined);
			_self.entityList[idx].setAdditionalData("comparePair", undefined);
		}
		delete _self.adjudicationEntityList[idx];
	});

	$.each(this.adjudicationRelationList, function(idx, relation) {
		if(relation.decideIdx !== undefined) {
			relation.compareAObj[relation.decideIdx].id = relation.id;
			_self.relationList[idx] = relation.compareAObj[relation.decideIdx];
			_self.relationList[idx].setAdditionalData("adjudication", undefined);
			_self.relationList[idx].setAdditionalData("comparePair", undefined);
		}
		delete _self.adjudicationRelationList[idx];
	});

	this.adjudicationEntityList = [];
	this.adjudicationRelationList = [];
	this.projectList = undefined;

	this.completed = true;
}

AnaforaAdjudicationProject.prototype.checkNotgoldLinking = function() {
	// check if gold annotation link to non-gold annotation
	var _self = this;
	var checkNotgoldLinkingFunc = function(aObj) {
		var ungoldLinking = undefined;
		$.each(aObj.type.propertyTypeList, function(pIdx) {
			if(aObj.propertyList[pIdx] != undefined && aObj.type.propertyTypeList[pIdx].input == InputType.LIST) {
				$.each(aObj.propertyList[pIdx], function(lIdx, linkedAObj) {
					if(linkedAObj instanceof AdjudicationEntity || linkedAObj instanceof AdjudicationRelation) {
						if(linkedAObj.decideIdx === undefined)
							ungoldLinking = linkedAObj;
					}
					else {
						if(linkedAObj.getAdditionalData("adjudication") !== "gold")
							ungoldLinking = linkedAObj;
					}

					if(ungoldLinking != undefined)
						return false;
				});
			}
		});

		return ungoldLinking;
	}

	var errorAObj = undefined;
	var ungoldLinking = undefined;
	$.each(this.entityList, function(idx, aObj) {
		if(aObj.getAdditionalData("adjudication") == "gold") {
			ungoldLinking = checkNotgoldLinkingFunc(aObj);
			if(ungoldLinking !== undefined) {
				errorAObj = aObj;
				return false;
			}
		}
	});

	if(errorAObj != undefined) {
		return {"errorAObj":errorAObj, "linkedAObj":ungoldLinking};
	}

	$.each(this.relationList, function(idx, aObj) {
		if(aObj.getAdditionalData("adjudication") == "gold") {
			ungoldLinking = checkNotgoldLinkingFunc(aObj);
			if(ungoldLinking !== undefined) {
				errorAObj = aObj;
				return false;
			}
		}
	});

	if(errorAObj != undefined) {
		return {"errorAObj":errorAObj, "linkedAObj":ungoldLinking};
	}

	$.each(this.adjudicationEntityList, function(idx, aObj) {
		if(aObj.decideIdx !== undefined) {
			ungoldLinking = checkNotgoldLinkingFunc(aObj);
			if(ungoldLinking !== undefined) {
				errorAObj = aObj;
				return false;
			}
		}
	});

	if(errorAObj != undefined) {
		return {"errorAObj":errorAObj, "linkedAObj":ungoldLinking};
	}

	$.each(this.adjudicationRelationList, function(idx, aObj) {
		if(aObj.decideIdx !== undefined) {
			ungoldLinking = checkNotgoldLinkingFunc(aObj);
			if(ungoldLinking !== undefined) {
				errorAObj = aObj;
				return false;
			}
		}
	});

	if(errorAObj != undefined) {
		return {"errorAObj":errorAObj, "linkedAObj":ungoldLinking};
	}

	$.each(this.projectList, function(annotatorName) {
		$.each(_self.projectList[annotatorName].entityList, function(idx, aObj) {
			if(aObj.getAdditionalData("adjudication") == "gold") {
				ungoldLinking = checkNotgoldLinkingFunc(aObj);
				if(ungoldLinking !== undefined) {
					errorAObj = aObj;
					return false;
				}
			}
		});

		if(errorAObj != undefined)
			return false;

		$.each(_self.projectList[annotatorName].relationList, function(idx, aObj) {
			if(aObj.getAdditionalData("adjudication") == "gold") {
				ungoldLinking = checkNotgoldLinkingFunc(aObj);
				if(ungoldLinking !== undefined) {
					errorAObj = aObj;
					return false;
				}
			}
		});

		if(errorAObj != undefined)
			return false;
	});
	
	if(errorAObj != undefined) {
		return {"errorAObj":errorAObj, "linkedAObj":ungoldLinking};
	}

	return undefined;	
}

AnaforaAdjudicationProject.prototype.drawAObj = function(aObj) {
	var _self = this;
	if(aObj instanceof AdjudicationRelation) {
		$.each(aObj.compareAObj, function(idx, relation) {
			AnaforaProject.prototype.drawAObj.call(_self, relation);
		});
	}
	else {
		AnaforaProject.prototype.drawAObj.call(this, aObj);
	}
}

AnaforaAdjudicationProject.prototype.readFromXMLDOM = function(xml) {
	var xmlDOM = $(xml);
	var infoDOM = xmlDOM.find("info");
	var tInfoDOM = infoDOM.clone();
	tInfoDOM.find("progress").each( function() { $(this).text("completed"); });
	this.completed = (infoDOM.find("progress").text() == "completed");
	var schemaDOM = xmlDOM.find("schema");
	var annotationDOM = xmlDOM.find("annotations");
	var adjudicationDOM = xmlDOM.find("adjudication");
	var _self = this;
	var idx, annotatorName, entity, relation;
	var aObj;
	var projectXMLList = {};

	if(this.completed) {
		AnaforaProject.prototype.readFromXMLDOM.call(this,xml);
		return ;
	}
	
	
	// parse annotations from
	$(annotationDOM).children().each( function() {

		var id = this.getElementsByTagName("id")[0].childNodes[0].nodeValue;
		idx = parseInt(id.split('@')[0]);
		annotatorName = id.split('@')[3];
			
		if(annotatorName == "gold") {
			var aObj = undefined;
			if (this.tagName == "entity") {
				aObj = Entity.genFromDOM(this, _self.schema);
				_self.entityList[idx] = aObj;
			}
			else {
				aObj = Relation.genFromDOM(this, _self.schema);
				_self.relationList[idx] = aObj;
			}

			_self.addTypeCount(aObj.type);

			if(aObj.getAdditionalData("adjudication") == "gold")
				_self.completeAdjudication++;
		}
		else {
			if(!(annotatorName in projectXMLList)) {
				var newXML = $($.parseXML('<?xml version="1.0" encoding="UTF-8"?><data></data>'));
				newXML.children(0).append($(tInfoDOM).children(0));
				newXML.children(0).append($(schemaDOM).children(0));
				newXML.children(0).append($($.parseXML("<annotations></annotations>")).children(0));
				projectXMLList[annotatorName] = newXML;

			}

			var projectXML = projectXMLList[annotatorName];
			projectXML.find("annotations").append(this);
		}
	});

	if(Object.keys(projectXMLList).length > 0) {
		this.projectList = {};
		$.each(projectXMLList, function(annotatorName, projectXML) {
			_self.projectList[annotatorName] = new AnaforaProject(_self.schema, annotatorName, _self.task);
			// put gold annotation to both project;
			$.each(_self.entityList, function(eIdx, entity) {
				_self.projectList[annotatorName].entityList[eIdx] = entity;
			});

			$.each(_self.relationList, function(rIdx, relation) {
				_self.projectList[annotatorName].relationList[rIdx] = relation;
			});

			_self.projectList[annotatorName].setAnnotateFrame(_self.annotateFrame);
			_self.projectList[annotatorName].readFromXMLDOM(projectXML, true); 

			_self.totalAdjudication += Object.keys(_self.projectList[annotatorName].entityList).length;
			_self.totalAdjudication += Object.keys(_self.projectList[annotatorName].relationList).length;
		});
	}


	// reading <adjudication> dom
	if(this.projectList != undefined) {
	
		$(adjudicationDOM).children().each( function() {
			if (this.tagName == "entity") 
				aObj = AdjudicationEntity.genFromDOM(this, _self.schema, _self.projectList);
			else
				aObj = AdjudicationRelation.genFromDOM(this, _self.schema, _self.projectList);
			idx = parseInt(aObj.id.split('@')[0]);
			if (aObj instanceof Entity)
				_self.adjudicationEntityList[idx] = aObj;
			else
				_self.adjudicationRelationList[idx] = aObj;

			if(_self.annotateFrame != undefined) {
				_self.annotateFrame.updatePosIndex(aObj);
			}

			_self.addTypeCount(aObj.type);
	
		});
	}

	this.maxEntityIdx = Math.max(this.maxEntityIdx, Object.keys(this.entityList).max(), Object.keys(this.adjudicationEntityList).max() );
	this.maxRelationIdx = Math.max(this.maxRelationIdx, Object.keys(this.relationList).max(), Object.keys(this.adjudicationRelationList).max() );

	// linking and re-count entity and relation
	if(this.projectList != undefined) {
		$.each(this.projectList, function(annotatorName, aProject) {
			$.each(aProject.entityList, function(idx, entity) {
				// reset empty aObj back
				if(entity instanceof EmptyEntity) {
					var emptyAnnotator = entity.id.split('@')[3];
					aProject.entityList[idx] = _self.findEntityByIdx(idx, emptyAnnotator);
				
					entity = aProject.entityList[idx];
				}
				else if (entity instanceof AdjudicationEntity) {
					;
				}
				else if (entity.id.split("@")[3] == "gold") {
					;
				}
				else {
					$.each(entity.type.propertyTypeList, function(pIdx, pType) {
						if(pType.input == InputType.LIST) {
							$.each(entity.propertyList[pIdx], function(plIdx) {
								if(entity.propertyList[pIdx][plIdx] instanceof EmptyEntity) {
									var emptyEntity = entity.propertyList[pIdx][plIdx];
									var emptyId = parseInt(emptyEntity.id.split('@')[0]);
									var emptyAnnotator = emptyEntity.id.split('@')[3];
		
	
  entity.propertyList[pIdx][plIdx] = _self.findEntityByIdx(emptyId, emptyAnnotator);
								}
								else
									return false;
							});
							entity.propertyList[pIdx].sort(IAnaforaObj.sort);
						}
					});
				
					var comparePairEntityListStr = entity.getAdditionalData("comparePair");
					if(comparePairEntityListStr != undefined) {
						var comparePairEntityList = [];
						$.each(comparePairEntityListStr.split(','), function(idx, id) {
							var terms = id.split('@');
							var tIdx = parseInt(terms[0]);
							var tAnnotator = terms[3];
							var tEntity = undefined;
							var tEntity = _self.findEntityByIdx(tIdx, tAnnotator);
							if(tEntity == undefined)
								throw "find back comparePairEntityList error: " + id;
	
							comparePairEntityList.push(tEntity);
						});
						entity.setAdditionalData("comparePair", comparePairEntityList);
					}
	
					var comparePairEntityList = entity.getAdditionalData("comparePair");
					if(comparePairEntityList == undefined || !(comparePairEntityList[comparePairEntityList.length - 1] instanceof AdjudicationEntity)) {
						_self.addTypeCount(entity.type);
						if(_self.annotateFrame != undefined)
							_self.annotateFrame.updatePosIndex(entity);
					}

					if(entity.getAdditionalData("adjudication") == "gold") {
						_self.completeAdjudication++;
					}
				}

			});

			$.each(aProject.relationList, function(idx, relation) {
				
				if(relation instanceof EmptyRelation) {
					var emtptyAnnotator = relation.id.split('@')[3];
					aProject.relationList[idx] = _self.findRelationByIdx(idx, "gold");
				
					relation = aProject.relationList[idx];

				}
				else if (relation instanceof AdjudicationRelation) {
					;
				}
				else if (relation.id.split('@')[3] == "gold") {
					;
				}
				else {
					$.each(relation.type.propertyTypeList, function(pIdx, pType) {
						if(pType.input == InputType.LIST && relation.propertyList[pIdx] != undefined) {
							$.each(relation.propertyList[pIdx], function(plIdx) {
								if(relation.propertyList[pIdx][plIdx] instanceof EmptyEntity) {
									var emptyEntity = relation.propertyList[pIdx][plIdx];
									var emptyId = parseInt(emptyEntity.id.split('@')[0]);
									var emptyAnnotator = emptyEntity.id.split('@')[3];
  									relation.propertyList[pIdx][plIdx] = _self.findEntityByIdx(emptyId, emptyAnnotator);
								}
								else if(relation.propertyList[pIdx][plIdx] instanceof EmptyRelation) {
									var emptyRelation = relation.propertyList[pIdx][plIdx];
									var emptyId = parseInt(emptyRelation.id.split('@')[0]);
									var emtptyAnnotator = emptyRelation.id.split('@')[3];
  									relation.propertyList[pIdx][plIdx] = _self.findRelationByIdx(emptyId, emptyAnnotator);
								}
								else
									return false;
							});
							
							relation.propertyList[pIdx].sort(IAnaforaObj.sort);
						}
					});

					var comparePairRelationListStr = relation.getAdditionalData("comparePair");
					if(comparePairRelationListStr != undefined) {
						var comparePairRelationList = [];
						$.each(comparePairRelationListStr.split(','), function(idx, id) {
							var terms = id.split('@');
							var tIdx = parseInt(terms[0]);
							var tAnnotator = terms[3];
							var tRelation = undefined;
							if(tAnnotator == "gold") {
								tRelation = _self.adjudicationRelationList[tIdx];
							}
							else {
								tRelation = _self.projectList[tAnnotator].relationList[tIdx];
							}
							if(tRelation == undefined)
								throw "find back comparePairRelationList error: " + id;
	
							comparePairRelationList.push(tRelation);
						});
						relation.setAdditionalData("comparePair", comparePairRelationList);
					}
	
					var comparePairRelationList = relation.getAdditionalData("comparePair");
					if(comparePairRelationList == undefined || !(comparePairRelationList[comparePairRelationList.length - 1] instanceof AdjudicationRelation)) {
						_self.addTypeCount(relation.type);
						if(_self.annotateFrame != undefined)
							_self.annotateFrame.updatePosIndex(relation);
							
					}

					if(relation.getAdditionalData("adjudication") == "gold") {
						_self.completeAdjudication++;
					}
				}

			});
		});
	}

	$.each(this.entityList, function(idx, entity) {
		// update link

		$.each(entity.type.propertyTypeList, function(pIdx, pType) {
			if(pType.input == InputType.LIST && entity.propertyList[pIdx] != undefined) {
				$.each(entity.propertyList[pIdx], function(plIdx) {

					if(entity.propertyList[pIdx][plIdx] instanceof EmptyEntity) {
						var emptyEntity = entity.propertyList[pIdx][plIdx];
						var emptyId = parseInt(emptyEntity.id.split('@')[0]);
						var emptyAnnotator = emptyEntity.id.split('@')[3];
  						entity.propertyList[pIdx][plIdx] = _self.findEntityByIdx(emptyId, emptyAnnotator);
					}
					else if(entity.propertyList[pIdx][plIdx] instanceof EmptyRelation) {
						var emptyRelation = entity.propertyList[pIdx][plIdx];
						var emptyId = parseInt(emptyRelation.id.split('@')[0]);
						var emtptyAnnotator = emptyRelation.id.split('@')[3];
  						entity.propertyList[pIdx][plIdx] = _self.findRelationByIdx(emptyId, emptyAnnotator);
					}
					else
						return false;
				});
				
				entity.propertyList[pIdx].sort(IAnaforaObj.sort);
			}
		});
		// update posindex
		if(_self.annotateFrame != undefined)
			_self.annotateFrame.updatePosIndex(entity);
	});

	$.each(this.relationList, function(idx, relation) {
		// update relation list link
		$.each(relation.type.propertyTypeList, function(pIdx, pType) {
			if(pType.input == InputType.LIST && relation.propertyList[pIdx] != undefined) {
				$.each(relation.propertyList[pIdx], function(plIdx) {
					if(relation.propertyList[pIdx][plIdx] instanceof EmptyEntity) {
						var emptyEntity = relation.propertyList[pIdx][plIdx];
						var emptyId = parseInt(emptyEntity.id.split('@')[0]);
						var emptyAnnotator = emptyEntity.id.split('@')[3];
  						relation.propertyList[pIdx][plIdx] = _self.findEntityByIdx(emptyId, emptyAnnotator);
					}
					else if(relation.propertyList[pIdx][plIdx] instanceof EmptyRelation) {
						var emptyRelation = relation.propertyList[pIdx][plIdx];
						var emptyId = parseInt(emptyRelation.id.split('@')[0]);
						var emtptyAnnotator = emptyRelation.id.split('@')[3];
  						relation.propertyList[pIdx][plIdx] = _self.findRelationByIdx(emptyId, emptyAnnotator);
					}
					else
						return false;
				});
				
				relation.propertyList[pIdx].sort(IAnaforaObj.sort);
			}
		});
		// update posindex
		if(_self.annotateFrame != undefined)
			_self.annotateFrame.updatePosIndex(relation);
	});

	if(this.relationList[12] != undefined)
	this.relationList[12].propertyList[1].sort(IAnaforaObj.sort);

	this.totalAdjudication -= Object.keys(this.entityList).length;
	this.totalAdjudication -= Object.keys(this.relationList).length;
	this.totalAdjudication -= Object.keys(this.adjudicationEntityList).length;
	this.totalAdjudication -= Object.keys(this.adjudicationRelationList).length;

	if(this.annotateFrame != undefined)
		this.annotateFrame.generateAllAnnotateOverlapList();
	this.updateProgressBar();
}

AnaforaAdjudicationProject.prototype.findEntityByIdx = function(idx, annotator) {
	if(annotator == "gold") {
		if(idx in this.entityList)
			return this.entityList[idx];
		else if(idx in this.adjudicationEntityList)
			return this.adjudicationEntityList[idx]
		else
			return undefined;
			
	}
	else {
		return this.projectList[annotator].findEntityByIdx(idx);
	}
}

AnaforaAdjudicationProject.prototype.findRelationByIdx = function(idx, annotator) {
	if(annotator == "gold") {
		if(idx in this.relationList)
			return this.relationList[idx];
		else if(idx in this.adjudicationRelationList)
			return this.adjudicationRelationList[idx]
		else
			return undefined;
			
	}
	else {
		return this.projectList[annotator].findRelationByIdx(idx);
	}
}
