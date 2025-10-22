const express = require('express');
const router = express.Router();
const Auth = require('../middlewares/auth')
const Module_controller = require('../controllers/module.ctrl');

// Create a new module
router.post('/create', Auth, Module_controller.create_module);
router.put('/edit/:moduleId', Auth, Module_controller.edit_module);
router.get('/get/:moduleId', Auth, Module_controller.get_module);
router.delete('/remove/:moduleId', Auth, Module_controller.remove_module);

// mcq submission route
router.post('/submit-mcq/:moduleId', Auth, Module_controller.submit_mcq);
module.exports = router;