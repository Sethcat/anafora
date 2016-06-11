# coding:utf-8
# Create your views here.
from django.template import Context, loader
from django.http import HttpResponse, HttpResponseNotFound, HttpResponseForbidden
from django.shortcuts import render
from django.conf import settings
from django.core.context_processors import csrf
from django.utils.encoding import smart_unicode, smart_str
import codecs
#from Anafora.anaforaProjectManager import AnaforaProjectManager
from anaforaProjectManager import *
from projectSetting import *
import subprocess
import json
import os, sys
import grp
import pwd
from django.core.cache import cache
try:
	import xml.etree.cElementTree as et
except:
	import xml.etree.ElementTree as et

segment = '>>>'

css = ["css/style.css", "css/themes/default/style.css"]

js_lib = ["js/lib/" + js_file for js_file in ["jquery.jstree.js", "jquery.jstree.schema.js", "jquery.hotkeys.js", "jquery.ui.position.js", "jquery.contextMenu.js", "jquery.json-2.4.min.js", "jquery.cookie.js"]]

js_annotate = ["js/annotate/" + js_file for js_file in  ["schema.js", "anaforaProject.js", "anaforaObj.js", "annotate.js", "propertyFrame.js", "annotateFrame.js", "aObjSelectionMenu.js", "projectSelector.js", "anaforaAdjudicationProject.js", "relationFrame.js"]]

js_schemaSpecific = {"Coreference": {"adjudication":["js/annotate/anaforaAdjudicationProjectCoreference.js"]}}

account = ""

grpID = grp.getgrnam(settings.ADMIN_GROUPNAME)[2]
AnaforaProjectManager.rootPath = settings.ANAFORA_PROJECT_FILE_ROOT

projectSetting = None

def index(request, projectName="", corpusName="", taskName="", schema="", schemaMode="", annotatorName=""):

	if request.method != "GET":
		return HttpResponseForbidden()

	if (schemaMode == "Adjudication" or annotatorName != "") and isAdjudicator(request) != True:
		return HttpResponseForbidden("access not allowed")

	if (schema != ""):
		if isSchemaExist(schema) != True:
			return HttpResponseNotFound("schema file not found")

	isAdjudication = False

	if (schemaMode == "Adjudication"):
		isAdjudication = True
		
	rawText = ""

	if projectName == "":
		pass
	elif corpusName == "":
		pass
	elif  taskName == "":
		pass
	else:
		try:
			rawTextFile = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName, taskName)
			fhd = open(rawTextFile)
			rawText = fhd.read()
			fhd.close()
		except:
			return HttpResponseForbidden("raw text file open error: " + rawTextFile)
	if isinstance(rawText, str):
		rawText = rawText.decode('utf-8')
	segmentidx = 0
	sentenceidxlist = []
	while True:		
		segmentidx =  rawText.find(segment, segmentidx)
		if segmentidx != -1:
			sentenceidxlist.append(segmentidx)
			segmentidx += 1
		else:
			break
	account = request.META["REMOTE_USER"]
	ps = getProjectSetting()
	schemaMap = ps.getSchemaMap()
	if annotatorName == "":
		annotatorName = account
	else:
		if ";" not in annotatorName:
			isAdjudication = False
	
	js_schemaSpecific = {"Coreference": {"adjudication":["js/annotate/anaforaAdjudicationProjectCoreference.js"]}}
	contextContent = {
		'js': (js_lib + js_annotate) if settings.DEBUG else (js_lib + ["js/out.js"]) ,
		'js_schemaSpecific': js_schemaSpecific, 
		'css': css,
		'title': taskName + ' - Anafora',
		'rawText': rawText.replace("&", "&amp;").replace("<", "&lt;").replace("\r", "&#13;").replace("\n", "&#10;"),
		'root_url': settings.ROOT_URL,
		'settingVars': {
			'refresh': 'true',
			'startrecord':'',
			'pre_or_next': 1,
			'sentenceidx': -1,
			'maxsenidx': len(sentenceidxlist)-1,
			'sentenceidxlist': sentenceidxlist,
			'app_name': "annotate", 'projectName': projectName, 'corpusName': corpusName, \
				'taskName': taskName, 'schema': schema, 'isAdjudication': isAdjudication, 'annotator': annotatorName, \
				'remoteUser': request.META["REMOTE_USER"], 'schemaMap': json.dumps( schemaMap )},
		#'control_response': '',
	}
	contextContent.update(csrf(request))
	context = Context(contextContent)
	return render(request, 'annotate/index.html', context)

def getAnaforaXMLFile(request, projectName, corpusName, taskName, schema, annotatorName = "",):
	"""
	Given projectName, corpusName, taskName and schema, return the XML data file content

	the default of annotatorName is request.META["REMOTE_USER"]. If annotatorName is assigned, then return this specific annotator's file (annotator permission required) 
	"""
	if request.method != "GET":
		return HttpResponseForbidden()

	if isSchemaExist(schema) != True:
		return HttpResponseNotFound("schema file not found")

	schema = schema.replace(".", "-")

	if annotatorName != "" and annotatorName != request.META["REMOTE_USER"] and isAdjudicator(request) is not True and annotatorName != "preannotation" :
		return HttpResponseForbidden("access not allowed")

	account = request.META["REMOTE_USER"] if annotatorName == "" else annotatorName
	anaforaXMLFile = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName, taskName + "." + schema + "." + account)
	anaforaXML = ""
	if os.path.exists(anaforaXMLFile + ".completed.xml"):
		anaforaXMLFile = anaforaXMLFile + ".completed.xml"
	elif os.path.exists(anaforaXMLFile + ".inprogress.xml"):
		anaforaXMLFile = anaforaXMLFile + ".inprogress.xml"
	else:
		return HttpResponseNotFound("file not found")	
	fhd = open(anaforaXMLFile)
	anaforaXML = fhd.read()
	fhd.close()
	'''
	# 要逐条显示的是实体
	xmlHead = anaforaXML[:anaforaXML.find('<entity>')]
	start = int(request.GET['start'])
	end = int(request.GET['end'])
	if end == 0:
		# 首次加载
		rawTextFile = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName, taskName)
		fhd = open(rawTextFile)
		rawText = fhd.read()
		fhd.close()
		if isinstance(rawText, str):
			rawText = rawText.decode('utf-8')
		start = rawText.find(segment)
		end =  rawText.find(segment, start+1) 
		end =  end if end !=-1 else len(rawText) - start -1

	#if 'get_from_source' in request.GET: 
		#anaforaXMLFile += '.source'
	anaforaXMLFile += '.source'
	tree = et.ElementTree(file=anaforaXMLFile)
	entities = tree.getroot().findall('annotations/entity')
	propertytag = '评价'.decode('utf-8')

	for entity in entities:
		e_span =  entity.find('span').text
		e_position = int(e_span.split(',')[0])
		if e_position >= start and e_position < end:
			e_id = entity.find('id').text
			e_span = str(int(e_span.split(',')[0]) - start) + ',' + str(int(e_span.split(',')[1]) - start)
			e_type = entity.find('type').text.encode('utf-8')
			e_parentsType =  entity.find('parentsType').text.encode('utf-8')
			e_properties = entity.find('properties').find(propertytag).text.encode('utf-8')
			e_data = '<entity>\n\t\t<id>{0}</id>\n\t\t<span>{1}</span>\n\t\t<type>{2}</type>\n\t\t<parentsType>{3}</parentsType>\n\t\t<properties>\n\t\t\t<{4}>{5}</{4}>\n\t\t</properties>\n\t</entity>\n\n\t'.format(e_id, e_span, e_type, e_parentsType, propertytag.encode('utf-8'), e_properties)
			xmlHead += e_data
	xmlHead += '</annotations>\n\n</data>'
	return HttpResponse(xmlHead)
	'''
	return HttpResponse(anaforaXML)
def getCompleteAnnotator(request, projectName, corpusName, taskName, schemaName) :
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")
	if isAdjudicator(request):
		annotatorName = AnaforaProjectManager.getCompleteAnnotator(schemaName, projectName, corpusName, taskName)
		return HttpResponse(json.dumps(annotatorName))

	return HttpResponseForbidden("access not allowed")

def getInprogressAnnotator(request, projectName, corpusName, taskName, schemaName) :
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")
	if isAdjudicator(request):
		annotatorName = AnaforaProjectManager.getInprogressAnnotator(schemaName, projectName, corpusName, taskName)
		return HttpResponse(json.dumps(annotatorName))

	return HttpResponseForbidden("access not allowed")

def getAnnotator(request, projectName, corpusName, taskName, schemaName) :
	"""
	Given project, corpus, taskName and schemaName, return the list of annotator names
	adjudicator permission required
	"""
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	if isAdjudicator(request):
		annotatorName = AnaforaProjectManager.getAnnotator(schemaName, projectName, corpusName, taskName)

		return HttpResponse(json.dumps(annotatorName))

	return HttpResponseForbidden("access not allowed")
	

def getSchema(request, schema, schemaIdx=-1 ):
	"""
	given schema name, return the first schema file content

	if schemaIdx is specificed, return the idx-th schema file content
	"""

	if request.method != "GET":
		return HttpResponseForbidden()

	schema = schema.replace(".Adjudication", "")
	moreSchema = False

	ps = getProjectSetting()
	if schemaIdx==-1:
		schemaIdx = 0
	else:
		schemaIdx = int(schemaIdx)

	try:
		if "." in schema:
			[schema, mode] = schema.split(".")
		else:
			mode = "default"
		(schemaFileName, moreSchema) = ps.getSchemaFileNameFromSchemaAndMode(schema, schemaIdx, mode)

		schemaFile = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, ".schema", schemaFileName)
		fhd = open(schemaFile)
		schemaXML = fhd.read()
		fhd.close()
	except Exception as inst:
		return HttpResponseNotFound(inst)
		

	rJSON = {"moreSchema": moreSchema, "schemaXML": schemaXML}
	
	return HttpResponse(json.dumps(rJSON))

def getProject(request):
	if request.method != "GET":
		return HttpResponseForbidden()
	
	return HttpResponse(json.dumps(AnaforaProjectManager.getProject()))

def getCorpusFromProjectName(request, projectName):
	if request.method != "GET":
		return HttpResponseForbidden()

	try:
		corpusName = AnaforaProjectManager.getCorpusFromProject(projectName)
	except:
		return HttpResponseNotFound("corpus not found")
	
	return HttpResponse(json.dumps(corpusName))

def getAllTask(request, projectName, corpusName, schemaName):
	# Given projectName, corpusName, schemaName, return all the available task
	if request.method != "GET":
		return HttpResponseForbidden()

	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	if isAdjudicator(request):
		taskName = AnaforaProjectManager.searchAllTask(projectName, corpusName, schemaName)
		return HttpResponse(json.dumps(taskName))
	else:
		return HttpResponseForbidden("access not allowed")


def getAdjudicationTaskFromProjectCorpusName(request, projectName, corpusName, schemaName):
	if request.method != "GET":
		return HttpResponseForbidden()

	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")
	
	if isAdjudicator(request):
		taskName = AnaforaProjectManager.searchAvailableAdjudicationTask(projectName, corpusName, schemaName, request.META["REMOTE_USER"])
		return HttpResponse(json.dumps(taskName))
	else:
		return HttpResponseForbidden("access not allowed")

def getTaskFromProjectCorpusName(request, projectName, corpusName, schemaName):
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	ps = getProjectSetting()
	try:
		taskName = AnaforaProjectManager.searchAvailableTask(projectName, corpusName, schemaName, request.META["REMOTE_USER"], ps)
	except:
		return HttpResponseNotFound("project or corpus not found")

	return HttpResponse(json.dumps(taskName))

def writeFile(request, projectName, corpusName, taskName, schemaName):
	if request.method != "POST":
		return HttpResponseForbidden()

	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	schemaName = schemaName.replace(".", "-")

	filePath = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName)

	if os.path.exists(filePath) != True:
		return HttpResponseNotFound("project, corpus or task not found")
		
	
	fileContent = request.REQUEST["fileContent"]
	fileName = filePath + "/" + taskName + "." + schemaName + "." + (request.META["REMOTE_USER"])
	if os.path.exists(fileName + ".completed.xml"):
		fileName = fileName + ".completed.xml"
	else:
		fileName = fileName + ".inprogress.xml"

	fhd = codecs.open(fileName, "w+", "utf-8")
	fhd.write(fileContent)
	fhd.close()

	if "-Adjudication" in schemaName and ".completed.xml" in fileName:
		fileNameGold = fileName.replace("-Adjudication", "").replace("." + request.META["REMOTE_USER"] + ".", ".gold.")
		subprocess.call(["cp", fileName, fileNameGold])
		ps = getProjectSetting()
		schema = ps.getSchema(schemaName.split("-")[0])
		mode = ps.getMode(*(schemaName.replace("-Adjudication", "").split("-")))
		for tMode in schema.modes:
			if tMode.needPreannotation and tMode.preannotationFromMode == mode:
				fileNamePreannotation = filePath + "/" + taskName + "." + schema.name + "-" + tMode.name +  ".preannotation.completed.xml"
				subprocess.call(["cp", fileNameGold, fileNamePreannotation])

	return HttpResponse()
	
def setCompleted(request, projectName, corpusName, taskName, schemaName):
	if request.method != "POST":
		return HttpResponseForbidden()

	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	schemaName = schemaName.replace(".", "-")

	filePath = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName)

	if os.path.exists(filePath) != True:
		return HttpResponseNotFound("project, corpus or task not found")
		
	fileName = filePath + "/" +  taskName + "." + schemaName + "." + (request.META["REMOTE_USER"])

	ps = getProjectSetting()

	if os.path.exists(fileName + ".inprogress.xml"):
		subprocess.call(["mv", fileName + ".inprogress.xml", fileName + ".completed.xml"])
		subprocess.call("sed -u -i 's/<progress>in-progress<\/progress>/<progress>completed<\/progress>/' " + fileName + ".completed.xml", shell=True)

		if "-Adjudication" in schemaName:
			# set as gold
			fileNameGold = filePath + "/" + taskName + "." + schemaName.replace("-Adjudication", "") +  ".gold.completed.xml"
			subprocess.call(["cp", fileName + ".completed.xml", fileNameGold])
			schema = ps.getSchema(schemaName.split("-")[0])
			mode = ps.getMode(*(schemaName.replace("-Adjudication", "").split("-")))
			for tMode in schema.modes:
				if tMode.needPreannotation and tMode.preannotationFromMode == mode:
					fileNamePreannotation = filePath + "/" + taskName + "." + schema.name + "-" + tMode.name +  ".preannotation.completed.xml"
					subprocess.call(["cp", fileNameGold, fileNamePreannotation])


			
		return HttpResponse()
	else:
		return HttpResponseNotFound("in-progress file not found")

def isSchemaExist(testSchemaName):
	testSchemaName = testSchemaName.replace(".Adjudication", "")

	if testSchemaName.count(".") > 1:
		return False
	elif "." in testSchemaName:
		(schemaName, modeName) = testSchemaName.split('.')
	else:
		schemaName = testSchemaName
		modeName = "default"

	ps = getProjectSetting()
	return ps.isSchemaExist(schemaName, modeName)

def isAdjudicator(request):
	if "REMOTE_ADMIN" in request.META:
			return request.META["REMOTE_ADMIN"]
	else:
		testAdjudicator = request.META["REMOTE_USER"]
		return (grpID in [g.gr_gid for g in grp.getgrall() if testAdjudicator in g.gr_mem])


def getProjectSetting():
	global projectSetting
	if projectSetting != None:
		return projectSetting

	projectSetting = cache.get('anafora_project_setting')
	if projectSetting == None:
		projectSetting = ProjectSetting()
		projectSetting.parseFromFile(os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, settings.ANAFORA_PROJECT_SETTING_FILENAME))
		cache.set('anafora_project_setting', projectSetting)
	
	return projectSetting
def test_onebyone(request):
	if request.method != "GET":
		return HttpResponseForbidden()
	href = request.GET['href']
	arg_list = href.split('//')[1].split('/')[1:]
	projectName = arg_list[0]
	corpusName = arg_list[1]
	taskName = arg_list[2]
	schemaName = arg_list[3]
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	schemaName = schemaName.replace(".", "-")
	item_index = int(request.GET['item_index'])
	pre_or_next = int(request.GET['pre_or_next'])
	propertyValue = request.GET['propertyValue']	
	if item_index < 0:
		return HttpResponseNotFound("item index error!")

	filePath = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName)

	if os.path.exists(filePath) != True:
		return HttpResponseNotFound("project, corpus or task not found")
	fileName = filePath + "/" + taskName + "." + schemaName + "." + (request.GET['remote_user'])
	if os.path.exists(fileName + ".completed.xml"):
		fileName = fileName + ".completed.xml"
	else:
		fileName = fileName + ".inprogress.xml"

	result = ''
	tree = et.ElementTree(file=fileName)
	entities = tree.getroot().findall('annotations/entity')
	entity_modify = entities[item_index]
	next_step_index = item_index + pre_or_next
	
	if next_step_index == len(entities):
		result = 'completed'
	elif next_step_index < 0:
		result = 'first'
	else:
		result = entities[next_step_index].find('property/%s'%propertyname).text
	entity_modify.find('property/%s'%propertyname).text = str(propertyValue)
	tree.write(fileName)
	return HttpResponse(result)

def testme(request):
	propertyValue = ''
	if request.method == 'GET':
		propertyValue = request.GET['propertyValue']
	href = request.GET['href']
	arg_list = href.split('//')[1].split('/')[1:]
	projectName = arg_list[2]
	corpusName = arg_list[3]
	taskName = arg_list[4]
	schemaName = arg_list[5]
	remoteuser = request.GET['remote_user']

	account = request.META["REMOTE_USER"]
	ps = getProjectSetting()
	schemaMap = ps.getSchemaMap()
	isAdjudication = False
	
	annotatorName = account
	schema = ""
	#return HttpResponse(' '.join(arg_list))
	
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	schemaName = schemaName.replace(".", "-")
	item_index = int(request.GET['item_index'])
	pre_or_next = int(request.GET['pre_or_next'])
	propertyValue = request.GET['propertyValue']	
	
	if item_index < 0:
		return HttpResponseNotFound("item index error!")
	filePath = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName)

	if os.path.exists(filePath) != True:
		return HttpResponseNotFound("project, corpus or task not found")
	
	fileName = filePath + "/" + taskName + "." + schemaName + "." + remoteuser
	if os.path.exists(fileName + ".completed.xml"):
		fileName = fileName + ".completed.xml"
	else:
		fileName = fileName + ".inprogress.xml"
	#return HttpResponse(fileName)

	next_property = ''
	sentence = ''
	tree = et.ElementTree(file=fileName)
	entities = tree.getroot().findall('annotations/entity')
	entity_modify = entities[item_index]
	next_step_index = item_index + pre_or_next
	propertyname = '评价'.decode('utf-8')
	if next_step_index == len(entities):
		next_property = 'completed'
	elif next_step_index < 0:
		next_property = 'first'
	else:
		next_property = entities[next_step_index].find('properties/%s'%propertyname).text
	#return HttpResponse(result)
	entity_modify.find('properties/%s'%propertyname).text = str(propertyValue)
	tree.write(fileName, encoding='utf-8')
	#entities[next_step_index]
	
	#rawText = 'Hello ,world. Welcome to this project!'
	rawTextFile = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName, taskName)
	fhd = open(rawTextFile)
	rawText = fhd.read()
	fhd.close()
	js_schemaSpecific = {"Coreference": {"adjudication":["js/annotate/anaforaAdjudicationProjectCoreference.js"]}}

	contextContent = {
		'js': (js_lib + js_annotate) if settings.DEBUG else (js_lib + ["js/out.js"]) ,
		'js_schemaSpecific': js_schemaSpecific, 
		'css': css,
		'title': taskName + ' - Anafora',
		'rawText': rawText.replace("&", "&amp;").replace("<", "&lt;").replace("\r", "&#13;").replace("\n", "&#10;"),
		'root_url': settings.ROOT_URL,
		'settingVars': {'onebyone': "True", 'app_name': "annotate", 'projectName': projectName, 'corpusName': corpusName, 'taskName': taskName, 'schema': schema, 'isAdjudication': isAdjudication, 'annotator': annotatorName, 'remoteUser': request.META["REMOTE_USER"], 'schemaMap': json.dumps( schemaMap )},
		'control_response': '',
	}
	contextContent.update(csrf(request))
	context = Context(contextContent)
	return render(request, 'annotate/index.html', context)
	return HttpResponse(rawText)

	return HttpResponse(result)
def sentences_onebyone(request):
	xmldata = '<?xml version="1.0" encoding="UTF-8"?>\n\n<data>\n<info>\n\t\n\t<savetime>22:10:32 23-04-2016</savetime>\n\t<progress>completed</progress>\n</info>\n\n<schema path="./" protocol="file">temporal.schema.xml</schema>\n\n<annotations>\n\t<entity>\n\n\n\t<id>1@e@1652587_0@luyao</id>\n\n\n\t<span>109,112</span>\n\t\t\<type>整体情感倾向_t</type>\n\t\t<parentsType>Entities</parentsType>\n\t\t<properties>\n\t\t\t<评价>0</评价>\n\t\t</properties>\n\t	</entity>\n'
	xmldata += '\t<entity>\n\t\t<id>47@e@1652587_0@luyao</id>\n\t\t<span>113,115</span>\n\t\t<type>情感词_w</type>\n\t\t<parentsType>Entities</parentsType>\n\t\t<properties>\n\t\t\t<评价>uncertain</评价>\n\t\t\t</properties>\n	</entity>\n'
	xmldata += '\t<entity>\n\t\t<id>48@e@1652587_0@luyao</id>\n\t\t<span>113,123</span>\n\t\t<type>剧情_j</type>\n\t\t<parentsType>Entities</parentsType>\n\t\t<properties>\n\t\t\t<评价>0</评价>\n\t\t</properties>\n\t\t</entity>\n'
	xmldata += '</annotations>\n\t</data>'
	if isinstance(xmldata, str):
		xmldata = xmldata.decode('utf-8')
	return xmldata
def getAnaforaXMLFile_onebyone(request):

	if request.method != "GET":
		return HttpResponseForbidden()

	if not request.GET['index']:
		return HttpResponse('<?xml version="1.0" encoding="UTF-8"?><data><annotations><entity></entity></annotations></data>')
	href = request.GET['href']
	arg_list = href.split('//')[1].split('/')[1:]
	projectName = arg_list[2]
	corpusName = arg_list[3]
	taskName = arg_list[4]
	schemaName = arg_list[5]
	remoteuser = request.GET['user']

	account = request.META["REMOTE_USER"]
	#ps = getProjectSetting()
	#schemaMap = ps.getSchemaMap()
	#isAdjudication = False
	
	annotatorName = account
	schema = ""
	
	if isSchemaExist(schemaName) != True:
		return HttpResponseNotFound("schema file not found")

	schemaName = schemaName.replace(".", "-")	
	filePath = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName)

	if os.path.exists(filePath) != True:
		return HttpResponseNotFound("project, corpus or task not found")
	
	fileName = filePath + "/" + taskName + "." + schemaName + "." + remoteuser
	if os.path.exists(fileName + ".completed.xml"):
		fileName = fileName + ".completed.xml"
	else:
		fileName = fileName + ".inprogress.xml"
	rawTextFile = os.path.join(settings.ANAFORA_PROJECT_FILE_ROOT, projectName, corpusName, taskName, taskName)
	return HttpResponse(rawTextFile)
	fhd = open(rawTextFile)
	rawText = fhd.read()
	fhd.close()
	if rawText:
		rawText = 'hello, it\'s me!'
	return HttpResponse(rawText)