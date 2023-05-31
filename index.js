let cephForm = document.getElementById('ceph-form');

function getUsableStorage(nodes, replicas) {
  console.log('getUsableStorage(', nodes, ', ', replicas, ')');

  if(nodes.length < replicas) {
    console.log('Too few nodes, returning 0');
    return 0;
  }

  // Compute total raw (= not taking replication into account)
  let totalRaw = nodes.reduce((a, b) => a + b, 0);

  // Compute max raw storage used
  let storage = 0;
  for(var iter = 0; true; ++iter) {
    // Sort nodes by decreasing remaining capacity
    nodes.sort((a, b) => b - a);
    console.log('Nodes: ', nodes);

    // No space left
    if(nodes[replicas - 1] <= 0) {
      break;
    }

    // Find out how many nodes to use up
    let howMany = replicas;
    while(howMany < nodes.length && nodes[howMany - 1] == nodes[howMany]) {
      howMany++;
    }

    // Increase used storage and decrease capacity
    let amount = nodes[howMany - 1];
    console.log('Using ', amount, ' from ', howMany, ' nodes');
    storage += amount * howMany;
    for(var i = 0; i < howMany; ++i) {
      nodes[i] -= amount;
    }
    console.log(nodes);

    if(iter === 100) {
      console.error('Infinite loop detected');
      throw new Error('Infinite loop detected');
    }
  }

  console.log('Done, storage=', storage);
  return storage;
}

function computeResult() {
  try {
    // Get nodes as numbers
    let nodes = cephForm.elements['nodes'].value;
    nodes = nodes.split(/\s+/);
    nodes = nodes.filter(e => e.length > 0);
    nodes = nodes.map(e => {
      let v = parseInt(e, 10);
      if(isNaN(v)) {
        throw new Error('Invalid capacity');
      }
      return v;
    });

    // Compute total raw (= not taking replication into account)
    let totalRaw = nodes.reduce((a, b) => a + b, 0);

    if(cephForm.elements['mode'].value === 'replicated') {
      let replicas = parseInt(cephForm.elements['size-replicated'].value, 10);
      if(isNaN(replicas)) {
        throw new Error('Invalid size');
      }
      // replicated 3 -> erasure-coded 1+2
      let size = 1;
      let redundancy = replicas - 1;

      let result = getUsableStorage(nodes, replicas);
      document.getElementById('results').innerText = (
        'Maximum data stored: '
        + 'logical: ' + (result / replicas)
        + ', raw: ' + result
        + ', ' + (100.0 * result / totalRaw) + '%'
      );
    } else {
      size = parseInt(cephForm.elements['size-erasure'].value, 10);
      if(isNaN(size)) {
        throw new Error('Invalid size');
      }
      redundancy = parseInt(cephForm.elements['size-erasure-redundancy'].value, 10);
      if(isNaN(redundancy)) {
        throw new Error('Invalid redundancy');
      }

      let result = getUsableStorage(nodes, size + redundancy);
      document.getElementById('results').innerText = (
        'Maximum data stored: '
        + 'logical: ' + (result * size / (size + redundancy))
        + ', raw: ' + result
        + ', ' + (100.0 * result / totalRaw) + '%'
      );
    }
  } catch(error) {
    document.getElementById('results').innerText = error.message;
  }
}

function modeChanged() {
  console.log('Mode changed');
  if(cephForm.elements['mode'].value === 'replicated') {
    document.getElementById('size-replicated').style.display = '';
    document.getElementById('size-erasure').style.display = 'none';
  } else {
    document.getElementById('size-replicated').style.display = 'none';
    document.getElementById('size-erasure').style.display = '';
  }
  computeResult();
}
[].forEach.call(cephForm.elements['mode'], e => e.addEventListener('change', modeChanged));
modeChanged();

cephForm.elements['size-replicated'].addEventListener('change', computeResult);
cephForm.elements['size-erasure'].addEventListener('change', computeResult);
cephForm.elements['size-erasure-redundancy'].addEventListener('change', computeResult);
cephForm.elements['nodes'].addEventListener('change', computeResult);
computeResult();
