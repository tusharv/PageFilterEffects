function getUnit(name){
	switch(name){
		case 'blur':
			return 'px';
			break;
		case 'brightness':
		case 'contrast':
			return '';
			break;
		case 'hue-rotate':
			return 'deg';
			break;
		case 'saturate':
			return '%';
			break;
		default:
			return '';
			break;
	}
}

function isDefault(name, value){
	switch(name){
		case 'blur':
		case 'hue-rotate':
		case 'grayscale':
		case 'sepia':
		case 'invert':
			return (value == 0) ? true : false;
			break;
		case 'brightness':
		case 'contrast':
			return (value == 1) ? true : false;
			break;
		case 'saturate':
			return (value == 100) ? true : false;
			break;
		default:
			return '';
			break;
	}
}

function applyStyle(event=null){
	let config = "";
	document.querySelectorAll('input').forEach((e)=>{
		let {name, value} = e;
		if(e.type === 'range' && !isDefault(name,value)){
			config += `${name}(${value}${getUnit(name)}) `;
		}else if(e.type === 'checkbox' && !isDefault(name,e.checked)){
			config += `${name}(${e.checked?'1':'0'}) `;
		}
	});
	chrome.tabs.executeScript(null,{code:"document.body.style.transition='filter 3s ease-out';document.body.style.filter='" + config + "'"});
}

function resetStyle(){
	chrome.tabs.executeScript(null,{code:"document.body.style.filter='none'"});

	document.querySelectorAll('input').forEach((e)=>{
		let {name, value} = e;
		if(e.type === 'checkbox'){
			e.checked = false;
		}else if(e.type === 'range'){
			switch(name){
				case 'blur':
				case 'hue-rotate':
					e.value = 0;
					break;
				case 'brightness':
				case 'contrast':
					e.value = 1;
					break;
				case 'saturate':
					e.value = 100;
					break;
				default:
					break;
			}
		}
	});
}


function buttonClick(e){
	console.log(`buttonClick called with `,e);
	switch(e.target.id){
		case 'apply':
			applyStyle();
			break;
		case 'reset':
			resetStyle();
			break;
		default:
			break;
	}
}


document.addEventListener('DOMContentLoaded', function(){
	var buttons = document.querySelectorAll('button');
	buttons.forEach((b)=>{
		b.addEventListener('click', buttonClick);
	});

	var inputs = document.querySelectorAll('input');
	inputs.forEach((i)=>{
		i.addEventListener('change', applyStyle);
	});

})
