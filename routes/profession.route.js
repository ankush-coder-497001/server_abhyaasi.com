const express = require('express');
const router = express.Router();
const ProfessionController = require('../controllers/profession.ctrl');
const Auth = require('../middlewares/auth')
const Role_Validation = require('../middlewares/Role_Validation')

router.use(Auth);

router.post('/create', Role_Validation(['admin']), ProfessionController.create_profession);
router.post('/assign_courses/:professionId', Role_Validation(['admin']), ProfessionController.assign_courses);
router.put('/:professionId', Role_Validation(['admin']), ProfessionController.toggleProfessionVisibility);
router.get('/get/:professionId', ProfessionController.get_profession);
router.post('/enroll/:professionId', ProfessionController.enroll_in_profession);
router.post('/unenroll/:professionId', ProfessionController.unenroll_from_profession);
module.exports = router;