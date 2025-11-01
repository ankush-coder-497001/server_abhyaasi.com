const express = require('express');
const router = express.Router();
const Auth = require('../middlewares/auth')
const Module_controller = require('../controllers/module.ctrl');
const Role_Validation = require('../middlewares/Role_Validation')

// Create a new module
router.post('/create', Auth, Role_Validation(["admin"]), Module_controller.create_module);
router.put('/edit/:moduleId', Auth, Role_Validation(["admin"]), Module_controller.edit_module);
router.get('/get/:moduleId', Auth, Module_controller.get_module);
router.delete('/remove/:moduleId', Auth, Role_Validation(["admin"]), Module_controller.remove_module);
router.get('/get_my_module', Auth, Module_controller.get_my_module);


// mcq submission route
router.post('/submit-mcq/:moduleId', Auth, Module_controller.submit_mcq);

// code submission route
router.post('/submit-code/:moduleId', Auth, Module_controller.submit_code);

module.exports = router;