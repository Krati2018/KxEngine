CREATE DATABASE XaaS_BOT;

USE XaaS_BOT;

/*Table structure for table `Configurations` */

DROP TABLE IF EXISTS Configurations;

CREATE TABLE `Configurations` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `project` VARCHAR(255) NOT NULL,
  `dataJSON` LONGTEXT,
  `templateJSON` LONGTEXT,
  `createdAt` DATETIME NOT NULL,
  `updatedAt` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project` (`project`),
  UNIQUE KEY `Configurations_project_unique` (`project`)
) ENGINE=INNODB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

/*Table structure for table `SESSIONINFO` */

DROP TABLE IF EXISTS `SESSIONINFO`;

CREATE TABLE SESSIONINFO (
  `id` BIGINT(20) NOT NULL AUTO_INCREMENT,
  `sessionId` MEDIUMTEXT,
  `sessionvalue` MEDIUMTEXT,
  `createdAt` BIGINT(20) DEFAULT NULL,
  `updatedAt` BIGINT(20) DEFAULT NULL,
  `isDeleted` TINYINT(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=INNODB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;