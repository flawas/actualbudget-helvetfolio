
import api from '@actual-app/api';

console.log('API Keys:', Object.keys(api));
if (api.getBudgets) {
    console.log('getBudgets function FOUND');
} else {
    console.log('getBudgets function NOT FOUND');
}
